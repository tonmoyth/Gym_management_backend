import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { Gender } from "../../generated/prisma/client";
import { uploadToCloudinary } from "../../utils/cloudinary";
import fs from "fs";
import { QueryBuilder } from "../../utils/queryBuilder";
import { IQueryParams } from "../../interface/queryBuilder.interface";

interface ICertification {
  title: string;
  fileUrl: string;
  issuer: string;
  issueDate: string | Date;
  expiryDate?: string | Date | null;
  credentialId?: string | null;
  credentialUrl?: string | null;
}

interface IUpsertTrainerProfilePayload {
  bio?: string;
  gender?: Gender;
  experience?: number;
  specializationIds?: string[];
  certifications?: ICertification[];
}

const _calculateAndUpdateProfileCompletion = async (
  tx: any,
  trainerProfileId: string,
) => {
  let completionPercent = 0;

  const updatedProfile = await tx.trainerProfile.findUnique({
    where: { id: trainerProfileId },
    include: {
      user: { select: { profileImage: true } },
      specializations: { select: { id: true }, take: 1 },
      certifications: { select: { id: true }, take: 1 },
    },
  });

  if (updatedProfile) {
    if (updatedProfile.bio && updatedProfile.bio.trim().length > 0)
      completionPercent += 20;
    if (updatedProfile.user?.profileImage) completionPercent += 20;
    if (updatedProfile.gender) completionPercent += 10;
    if (updatedProfile.specializations.length > 0) completionPercent += 25;
    if (updatedProfile.certifications.length > 0) completionPercent += 25;

    await tx.trainerProfile.update({
      where: { id: trainerProfileId },
      data: { profileCompletionPercent: completionPercent },
    });

    return completionPercent;
  }
  return 0;
};

const _saveTrainerProfile = async (
  userId: string,
  payload: IUpsertTrainerProfilePayload,
  profilePhoto?: Express.Multer.File,
  certificationFiles: Express.Multer.File[] = [],
) => {
  // 1. Validate User Exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, profileImage: true },
  });

  if (!user) {
    throw new AppError(404, "User not found.");
  }

  // 2. Upload profile photo if provided
  let profilePhotoUrl = user.profileImage;
  if (profilePhoto) {
    try {
      // TODO: Replace Cloudinary implementation with AWS S3 uploader in future.
      profilePhotoUrl = await uploadToCloudinary(
        profilePhoto.path,
        "trainer-profiles",
      );
      // Remove temp file
      fs.unlinkSync(profilePhoto.path);
    } catch (error) {
      if (fs.existsSync(profilePhoto.path)) fs.unlinkSync(profilePhoto.path);
      throw new AppError(500, "Failed to upload profile photo.");
    }
  }

  // 2.5 Upload certification files if provided
  let certificationUrls: string[] = [];
  if (certificationFiles.length > 0) {
    try {
      for (const file of certificationFiles) {
        const url = await uploadToCloudinary(
          file.path,
          "trainer-certifications",
        );
        certificationUrls.push(url);
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      // Clean up remaining files
      for (const file of certificationFiles) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      throw new AppError(500, "Failed to upload certification files.");
    }
  }

  // 3. Process relations mapping
  const uniqueSpecializationIds = Array.from(
    new Set(payload.specializationIds || []),
  );

  // 4. Prisma Transaction
  const result = await prisma.$transaction(
    async (tx) => {
      // Upsert TrainerProfile
      const trainerProfile = await tx.trainerProfile.upsert({
        where: { userId },
        create: {
          userId,
          bio: payload.bio,
          gender: payload.gender,
          experience: payload.experience !== undefined ? payload.experience : 0,
        },
        update: {
          bio: payload.bio !== undefined ? payload.bio : undefined,
          gender: payload.gender !== undefined ? payload.gender : undefined,
          experience: payload.experience !== undefined ? payload.experience : undefined,
        },
        select: { id: true },
      });

      // Update User Profile Photo
      if (profilePhotoUrl !== user.profileImage) {
        await tx.user.update({
          where: { id: userId },
          data: { profileImage: profilePhotoUrl },
        });
      }

      // Sync Specializations
      if (payload.specializationIds !== undefined) {
        // Delete existing
        await tx.trainerSpecialization.deleteMany({
          where: { trainerId: trainerProfile.id },
        });
        // Insert new
        if (uniqueSpecializationIds.length > 0) {
          await tx.trainerSpecialization.createMany({
            data: uniqueSpecializationIds.map((tagId) => ({
              trainerId: trainerProfile.id,
              tagId,
            })),
          });
        }
      }

      // Sync Certifications
      if (payload.certifications !== undefined) {
        // Delete existing
        await tx.trainerCertification.deleteMany({
          where: { trainerId: trainerProfile.id },
        });
        // Insert new
        if (payload.certifications.length > 0) {
          let fileIndex = 0;
          const mappedCertifications = payload.certifications.map((cert) => {
            let certUrl = cert.fileUrl;
            if (!certUrl && fileIndex < certificationUrls.length) {
              certUrl = certificationUrls[fileIndex];
              fileIndex++;
            }

            return {
              trainerId: trainerProfile.id,
              title: cert.title,
              fileUrl: certUrl || "", // Make sure we have a valid string or handle missing properly
              issuer: cert.issuer,
              issueDate: new Date(cert.issueDate),
              expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
              credentialId: cert.credentialId,
              credentialUrl: cert.credentialUrl,
            };
          });

          // Validate that no certifications are missing a file URL
          const invalidCerts = mappedCertifications.filter((c) => !c.fileUrl);
          if (invalidCerts.length > 0) {
            throw new AppError(
              400,
              "Missing file upload or fileUrl for one or more certifications.",
            );
          }

          await tx.trainerCertification.createMany({
            data: mappedCertifications,
          });
        }
      }

      // Calculate Profile Completion Percentage
      await _calculateAndUpdateProfileCompletion(tx, trainerProfile.id);

      // Fetch Final Profile to Return
      const finalProfile = await tx.trainerProfile.findUnique({
        where: { id: trainerProfile.id },
        select: {
          id: true,
          bio: true,
          gender: true,
          profileCompletionPercent: true,
          verifiedBadge: true,
          avgRating: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              profileImage: true,
            },
          },
          specializations: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          certifications: {
            select: {
              id: true,
              title: true,
              fileUrl: true,
              issuer: true,
              issueDate: true,
              expiryDate: true,
              credentialId: true,
              credentialUrl: true,
              status: true,
            },
          },
        },
      });

      if (finalProfile) {
        return {
          ...finalProfile,
          profilePhoto: finalProfile.user?.profileImage || null,
          user: undefined, // Expose cleanly via `profilePhoto`
          specializations: finalProfile.specializations.map((s) => s.tag),
        };
      }

      return finalProfile;
    },
    {
      maxWait: 5000,
      timeout: 15000,
    },
  );

  return result;
};

const getOwnTrainerProfile = async (userId: string) => {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      bio: true,
      gender: true,
      verifiedBadge: true,
      avgRating: true,
      profileCompletionPercent: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profileImage: true,
        },
      },
      specializations: {
        select: {
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          tag: {
            name: "asc",
          },
        },
      },
      certifications: {
        select: {
          id: true,
          title: true,
          issuer: true,
          issueDate: true,
          expiryDate: true,
          credentialId: true,
          credentialUrl: true,
        },
        orderBy: {
          issueDate: "desc",
        },
      },
      businesses: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          joinedAt: true,
          business: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
      },
    },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  return {
    id: trainerProfile.id,
    bio: trainerProfile.bio,
    gender: trainerProfile.gender,
    profilePhoto: trainerProfile.user.profileImage || "",
    verifiedBadge: trainerProfile.verifiedBadge,
    avgRating: trainerProfile.avgRating,
    profileCompletionPercent: trainerProfile.profileCompletionPercent,
    isProfileComplete: trainerProfile.profileCompletionPercent >= 80,
    user: {
      id: trainerProfile.user.id,
      name: trainerProfile.user.fullName || "",
      email: trainerProfile.user.email,
    },
    specializations: trainerProfile.specializations.map((s) => s.tag),
    certifications: trainerProfile.certifications,
    businesses: trainerProfile.businesses,
    createdAt: trainerProfile.createdAt,
    updatedAt: trainerProfile.updatedAt,
  };
};

const createTrainerProfile = async (
  userId: string,
  payload: IUpsertTrainerProfilePayload,
  profilePhoto?: Express.Multer.File,
  certificationFiles: Express.Multer.File[] = [],
) => {
  const existing = await prisma.trainerProfile.findUnique({
    where: { userId },
  });
  if (existing) {
    throw new AppError(400, "Trainer profile already exists.");
  }
  return _saveTrainerProfile(userId, payload, profilePhoto, certificationFiles);
};

const getPublicTrainerProfile = async (id: string) => {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      bio: true,
      gender: true,
      verifiedBadge: true,
      avgRating: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          profileImage: true,
          isActive: true,
        },
      },
      specializations: {
        select: {
          tag: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { tag: { name: "asc" } },
      },
      certifications: {
        select: {
          id: true,
          title: true,
          issuer: true,
          issueDate: true,
          expiryDate: true,
          credentialUrl: true,
        },
        orderBy: { issueDate: "desc" },
      },
      businesses: {
        where: { isActive: true },
        select: {
          id: true,
          business: {
            select: { id: true, name: true, logo: true },
          },
        },
      },
      reviews: {
        where: { isRemoved: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          member: {
            select: {
              id: true,
              user: {
                select: {
                  fullName: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!trainerProfile || trainerProfile.user?.isActive === false) {
    throw new AppError(404, "Trainer profile not found.");
  }

  // Get total review stats
  const reviewsAgg = await prisma.review.aggregate({
    where: { trainerId: id, isRemoved: false },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    id: trainerProfile.id,
    bio: trainerProfile.bio,
    gender: trainerProfile.gender,
    profilePhoto: trainerProfile.user?.profileImage || "",
    verifiedBadge: trainerProfile.verifiedBadge,
    avgRating: trainerProfile.avgRating,
    user: {
      id: trainerProfile.user?.id || "",
      name: trainerProfile.user?.fullName || "",
    },
    specializations: trainerProfile.specializations.map((s) => s.tag),
    certifications: trainerProfile.certifications,
    businesses: trainerProfile.businesses.map((b) => ({
      id: b.id,
      name: b.business.name,
      logo: b.business.logo,
    })),
    reviewSummary: {
      averageRating: reviewsAgg._avg.rating
        ? Number(reviewsAgg._avg.rating).toFixed(2)
        : "0.00",
      totalReviews: reviewsAgg._count.rating || 0,
    },
    recentReviews: trainerProfile.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      member: {
        id: r.member?.id || "",
        name: r.member?.user?.fullName || "",
        profilePhoto: r.member?.user?.profileImage || "",
      },
    })),
    createdAt: trainerProfile.createdAt,
  };
};

const getAllTrainers = async (query: IQueryParams) => {
  // Extract custom filters before they get processed generically if needed
  const { minRating, specialization, specializationId, ...restQuery } = query;

  const baseWhere: any = {
    verifiedBadge: true,
    user: {
      isActive: true,
    },
  };

  if (minRating) {
    baseWhere.avgRating = {
      gte: Number(minRating),
    };
  }

  if (specialization) {
    baseWhere.specializations = {
      some: {
        tag: {
          name: {
            equals: String(specialization),
            mode: "insensitive",
          },
        },
      },
    };
  }

  if (specializationId) {
    baseWhere.specializations = {
      ...baseWhere.specializations,
      some: {
        ...baseWhere.specializations?.some,
        tagId: String(specializationId),
      },
    };
  }

  const queryBuilder = new QueryBuilder(prisma.trainerProfile, restQuery, {
    searchableFields: ["user.fullName", "bio", "specializations.tag.name"],
    filterableFields: ["gender"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .where(baseWhere);

  const builtQuery = queryBuilder.getQuery();
  delete builtQuery.include;
  builtQuery.select = {
    id: true,
    bio: true,
    gender: true,
    verifiedBadge: true,
    avgRating: true,
    user: {
      select: {
        id: true,
        fullName: true,
        profileImage: true,
      },
    },
    specializations: {
      select: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { tag: { name: "asc" } },
    },
    businesses: {
      where: { isActive: true },
      select: {
        id: true,
        business: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    },
  };

  // We explicitly override select, so we must execute manually to map correctly
  // without the queryBuilder modifying select further or we can just run it.
  const [total, data] = await Promise.all([
    queryBuilder.count(),
    prisma.trainerProfile.findMany(builtQuery as any),
  ]);

  const mappedData = data.map((trainer: any) => ({
    id: trainer.id,
    bio: trainer.bio,
    gender: trainer.gender,
    profilePhoto: trainer.user?.profileImage || "",
    verifiedBadge: trainer.verifiedBadge,
    avgRating: trainer.avgRating,
    user: {
      id: trainer.user?.id || "",
      name: trainer.user?.fullName || "",
    },
    specializations: trainer.specializations.map((s: any) => s.tag),
    businesses: trainer.businesses.map((b: any) => ({
      id: b.id,
      name: b.business.name,
      logo: b.business.logo,
    })),
  }));

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: mappedData,
  };
};

const setOwnSpecializations = async (
  userId: string,
  specializationIds: string[],
) => {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  // Deduplicate UUIDs
  const uniqueTagIds = Array.from(new Set(specializationIds));

  // Validate all SpecializationTags
  const existingTags = await prisma.specializationTag.findMany({
    where: { id: { in: uniqueTagIds } },
    select: { id: true },
  });

  if (existingTags.length !== uniqueTagIds.length) {
    const existingIds = existingTags.map((t) => t.id);
    const invalidIds = uniqueTagIds.filter((id) => !existingIds.includes(id));
    throw new AppError(
      404,
      `One or more specialization tags not found: ${invalidIds.join(", ")}`,
    );
  }

  return await prisma.$transaction(async (tx) => {
    // Delete existing TrainerSpecializations
    await tx.trainerSpecialization.deleteMany({
      where: { trainerId: trainerProfile.id },
    });

    // Create new TrainerSpecializations
    if (uniqueTagIds.length > 0) {
      await tx.trainerSpecialization.createMany({
        data: uniqueTagIds.map((tagId) => ({
          trainerId: trainerProfile.id,
          tagId,
        })),
      });
    }

    // Recalculate profile completion
    const profileCompletionPercent = await _calculateAndUpdateProfileCompletion(
      tx,
      trainerProfile.id,
    );

    // Fetch the updated specializations
    const updatedSpecializations = await tx.trainerSpecialization.findMany({
      where: { trainerId: trainerProfile.id },
      select: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { tag: { name: "asc" } },
    });

    return {
      id: trainerProfile.id,
      profileCompletionPercent,
      isProfileComplete: profileCompletionPercent >= 80,
      specializations: updatedSpecializations.map((s) => s.tag),
    };
  });
};

const uploadCertification = async (
  userId: string,
  payload: any,
  file?: Express.Multer.File,
) => {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!trainerProfile) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new AppError(404, "Trainer profile not found.");
  }

  if (!file) {
    throw new AppError(400, "Certification file is required.");
  }

  if (payload.credentialId) {
    const existing = await prisma.trainerCertification.findFirst({
      where: {
        trainerId: trainerProfile.id,
        issuer: payload.issuer,
        credentialId: payload.credentialId,
      },
    });

    if (existing) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError(409, "This certification has already been uploaded.");
    }
  }

  let fileUrl = "";
  try {
    // TODO: Replace Cloudinary implementation with AWS S3 uploader in future.
    fileUrl = await uploadToCloudinary(file.path, "trainer-certifications");
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch (error) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new AppError(500, "Failed to upload certification file.");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Create Certification
    const newCertification = await tx.trainerCertification.create({
      data: {
        trainerId: trainerProfile.id,
        title: payload.title,
        fileUrl: fileUrl,
        issuer: payload.issuer,
        issueDate: new Date(payload.issueDate),
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
        credentialId: payload.credentialId,
        credentialUrl: payload.credentialUrl,
        status: "PENDING", // Always PENDING for new uploads
      },
      select: {
        id: true,
        title: true,
        issuer: true,
        issueDate: true,
        expiryDate: true,
        credentialId: true,
        credentialUrl: true,
        status: true,
        createdAt: true,
      },
    });

    // 2. Recalculate Profile Completion
    await _calculateAndUpdateProfileCompletion(tx, trainerProfile.id);

    return newCertification;
  });
};

const getOwnCertifications = async (userId: string) => {
  const trainerProfile = await prisma.user.findUnique({
    where: { id: userId },
    select: { trainerProfile: true },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  const certifications = await prisma.trainerCertification.findMany({
    where: { trainerId: trainerProfile.trainerProfile?.id },
    select: {
      id: true,
      title: true,
      issuer: true,
      issueDate: true,
      expiryDate: true,
      credentialId: true,
      credentialUrl: true,
      fileUrl: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const currentDate = new Date();

  return certifications.map((cert) => {
    let isExpired = false;
    if (cert.expiryDate) {
      isExpired = new Date(cert.expiryDate) < currentDate;
    }

    return {
      id: cert.id,
      title: cert.title,
      issuer: cert.issuer,
      issueDate: cert.issueDate,
      expiryDate: cert.expiryDate,
      credentialId: cert.credentialId,
      credentialUrl: cert.credentialUrl,
      documentUrl: cert.fileUrl,
      status: cert.status,
      isExpired,
      createdAt: cert.createdAt,
    };
  });
};

const getBusinessTrainerDashboard = async (
  userId: string,
  businessId: string,
) => {
  // 1. Get Trainer Profile
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { fullName: true, profileImage: true } },
    },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  // 2. Verify Business
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, logo: true, address: true },
  });

  if (!business) {
    throw new AppError(404, "Business not found.");
  }

  // 3. Verify Trainer belongs to Business
  const trainerBusiness = await prisma.trainerBusiness.findUnique({
    where: {
      trainerId_businessId: {
        trainerId: trainerProfile.id,
        businessId: businessId,
      },
    },
  });

  if (!trainerBusiness) {
    throw new AppError(403, "Trainer is not assigned to this business.");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const monthEnd = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const [
    todayScheduleRecords,
    upcomingClassesRecords,
    monthlyClassesAgg,
    assignedMemberBookings,
    todayBookingsCount,
    todayCheckIns,
    totalBookingsCount,
    totalCheckIns,
    recentActivitiesRecords,
    reviewsAgg,
  ] = await Promise.all([
    // Today's Schedule
    prisma.classSchedule.findMany({
      where: {
        businessId,
        trainerId: trainerProfile.id,
        startTime: { gte: todayStart, lte: todayEnd },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
      },
      orderBy: { startTime: "asc" },
    }),
    // Upcoming Classes
    prisma.classSchedule.findMany({
      where: {
        businessId,
        trainerId: trainerProfile.id,
        startTime: { gt: new Date() },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
      },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    // Monthly Statistics Classes
    prisma.classSchedule.findMany({
      where: {
        businessId,
        trainerId: trainerProfile.id,
        startTime: { gte: monthStart, lte: monthEnd },
      },
      select: {
        id: true,
        endTime: true,
        _count: { select: { bookings: { where: { status: "CANCELLED" } } } },
      },
    }),
    // Assigned Members
    prisma.classBooking.findMany({
      where: {
        classSchedule: { trainerId: trainerProfile.id, businessId },
      },
      select: { memberId: true },
      distinct: ["memberId"],
    }),
    // Today Attendance - Bookings
    prisma.classBooking.count({
      where: {
        classSchedule: {
          businessId,
          trainerId: trainerProfile.id,
          startTime: { gte: todayStart, lte: todayEnd },
        },
        status: "CONFIRMED",
      },
    }),
    // Today Attendance - Check Ins
    prisma.attendance.count({
      where: {
        businessId,
        checkInAt: { gte: todayStart, lte: todayEnd },
        type: "MEMBER",
        user: {
          memberProfile: {
            classBookings: {
              some: {
                classSchedule: {
                  trainerId: trainerProfile.id,
                  startTime: { gte: todayStart, lte: todayEnd },
                },
              },
            },
          },
        },
      },
    }),
    // Total Bookings for average attendance rate
    prisma.classBooking.count({
      where: {
        classSchedule: { trainerId: trainerProfile.id, businessId },
        status: "CONFIRMED",
      },
    }),
    // Total Check-Ins for average attendance rate
    prisma.attendance.count({
      where: {
        businessId,
        type: "MEMBER",
        user: {
          memberProfile: {
            classBookings: {
              some: { classSchedule: { trainerId: trainerProfile.id } },
            },
          },
        },
      },
    }),
    // Recent Member Activities
    prisma.attendance.findMany({
      where: {
        businessId,
        type: "MEMBER",
        user: {
          memberProfile: {
            classBookings: {
              some: { classSchedule: { trainerId: trainerProfile.id } },
            },
          },
        },
      },
      select: {
        checkInAt: true,
        user: { select: { fullName: true } },
      },
      orderBy: { checkInAt: "desc" },
      take: 5,
    }),
    // Quick Stats - Reviews
    prisma.review.aggregate({
      where: { trainerId: trainerProfile.id },
      _avg: { rating: true },
      _count: { id: true },
    }),
  ]);

  const assignedMemberIds = assignedMemberBookings.map((b) => b.memberId);
  const totalAssignedMembers = assignedMemberIds.length;

  const [activeMembersCount, newMembersCount] = await Promise.all([
    prisma.membership.count({
      where: {
        memberId: { in: assignedMemberIds },
        businessId,
        status: "ACTIVE",
      },
    }),
    prisma.memberProfile.count({
      where: {
        id: { in: assignedMemberIds },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    }),
  ]);

  const inactiveMembers = totalAssignedMembers - activeMembersCount;

  const todaySchedule = todayScheduleRecords.map((c) => ({
    id: c.id,
    className: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
    totalBookedMembers: c._count.bookings,
    status: c.endTime < new Date() ? "COMPLETED" : "UPCOMING",
  }));

  const upcomingClasses = upcomingClassesRecords.map((c) => ({
    id: c.id,
    className: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
    totalBookedMembers: c._count.bookings,
  }));

  const classesThisMonth = monthlyClassesAgg.length;
  const completedClasses = monthlyClassesAgg.filter(
    (c) => c.endTime < new Date(),
  ).length;
  const cancelledClasses = monthlyClassesAgg.reduce(
    (acc, curr) => acc + curr._count.bookings,
    0,
  );

  const todayAbsent = Math.max(0, todayBookingsCount - todayCheckIns);
  const todayAttendanceRate =
    todayBookingsCount > 0
      ? Math.round((todayCheckIns / todayBookingsCount) * 100)
      : 0;

  const averageAttendanceRate =
    totalBookingsCount > 0
      ? Math.round((totalCheckIns / totalBookingsCount) * 100)
      : 0;

  const recentMemberActivities = recentActivitiesRecords.map((a) => ({
    memberName: a.user.fullName,
    activity: "Checked In",
    time: a.checkInAt,
  }));

  return {
    business,
    trainer: {
      id: trainerProfile.id,
      name: trainerProfile.user?.fullName || "",
      profilePhoto: trainerProfile.user?.profileImage || "",
      verifiedBadge: trainerProfile.verifiedBadge,
      avgRating: Number(trainerProfile.avgRating),
    },
    todaySchedule,
    assignedMembers: {
      totalAssignedMembers,
      activeMembers: activeMembersCount,
      inactiveMembers,
    },
    todayAttendance: {
      checkedIn: todayCheckIns,
      absent: todayAbsent,
      attendanceRate: todayAttendanceRate,
    },
    monthlyStatistics: {
      classesThisMonth,
      completedClasses,
      cancelledClasses,
      newMembersThisMonth: newMembersCount,
    },
    upcomingClasses,
    recentMemberActivities,
    quickStatistics: {
      averageAttendanceRate,
      averageMemberRating: reviewsAgg._avg.rating || 0,
      totalReviews: reviewsAgg._count.id,
    },
  };
};

const getBusinessTrainers = async (userId: string, businessId: string, queryParams: any) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "Business not found");
  }

  if (business.ownerId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, "You do not own this business");
  }

  const params = { ...queryParams };
  
  if (params.specializationId) {
    params["specializations.tagId"] = params.specializationId;
    delete params.specializationId;
  }
  if (params.minRating) {
    params["avgRating[gte]"] = params.minRating;
    delete params.minRating;
  }

  const trainerConfig = {
    searchableFields: ["user.fullName", "user.email", "specializations.tag.name", "bio"],
    filterableFields: ["gender", "verifiedBadge", "avgRating", "specializations.tagId"],
  };

  const trainerQuery = new QueryBuilder(
    prisma.trainerProfile,
    { ...params, sortBy: params.sortBy || "createdAt", sortOrder: params.sortOrder || "desc" },
    trainerConfig
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .where({
      businesses: {
        some: {
          businessId,
          isActive: true,
        },
      },
    });

  const args = trainerQuery.getQuery();
  delete args.include;
  args.select = {
    id: true,
    user: { select: { fullName: true, email: true, profileImage: true } },
    bio: true,
    verifiedBadge: true,
    avgRating: true,
    profileCompletionPercent: true,
    gender: true,
    specializations: {
      select: { tag: { select: { id: true, name: true, slug: true } } },
    },
    businesses: {
      where: { businessId },
      select: { joinedAt: true },
    },
  };

  const [total, data] = await Promise.all([
    trainerQuery.count(),
    prisma.trainerProfile.findMany(args as any),
  ]);

  const formattedData = data.map((t: any) => ({
    id: t.id,
    name: t.user?.fullName,
    email: t.user?.email,
    profilePhoto: t.user?.profileImage,
    bio: t.bio,
    verifiedBadge: t.verifiedBadge,
    avgRating: Number(t.avgRating || 0),
    profileCompletionPercent: t.profileCompletionPercent,
    gender: t.gender,
    specializations: t.specializations.map((s: any) => ({
      id: s.tag.id,
      name: s.tag.name,
      slug: s.tag.slug,
    })),
    joinedAt: t.businesses[0]?.joinedAt,
  }));

  return {
    meta: {
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(params.limit) || 10)),
    },
    data: formattedData,
  };
};

const removeBusinessTrainer = async (userId: string, businessId: string, trainerId: string) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true, name: true },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "Business not found");
  }

  if (business.ownerId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, "You do not own this business");
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: { user: { select: { id: true, fullName: true, email: true } } },
  });

  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, "Trainer not found");
  }

  const trainerBusiness = await prisma.trainerBusiness.findUnique({
    where: {
      trainerId_businessId: { trainerId, businessId },
    },
  });

  if (!trainerBusiness) {
    throw new AppError(httpStatus.NOT_FOUND, "Trainer not assigned to this business");
  }

  await prisma.$transaction([
    prisma.trainerBusiness.delete({
      where: {
        trainerId_businessId: { trainerId, businessId },
      },
    }),
  ]);

  const { pushJob } = require("../../utils/redisQueue");

  pushJob("job_application_queue", {
    eventType: "TRAINER_REMOVED_FROM_BUSINESS",
    trainerId,
    trainerUserId: trainer.user.id,
    businessId,
    businessName: business.name,
    trainerName: trainer.user.fullName,
    trainerEmail: trainer.user.email,
  });

  return null;
};

export const TrainerProfileService = {
  createTrainerProfile,
  getOwnTrainerProfile,
  getPublicTrainerProfile,
  getAllTrainers,
  setOwnSpecializations,
  uploadCertification,
  getOwnCertifications,
  getBusinessTrainerDashboard,
  getBusinessTrainers,
  removeBusinessTrainer,
};

