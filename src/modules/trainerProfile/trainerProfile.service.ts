import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
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
  specializationIds?: string[];
  certifications?: ICertification[];
}

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
        },
        update: {
          bio: payload.bio !== undefined ? payload.bio : undefined,
          gender: payload.gender !== undefined ? payload.gender : undefined,
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
      let completionPercent = 0;

      const updatedProfile = await tx.trainerProfile.findUnique({
        where: { id: trainerProfile.id },
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

        // Update completion percent
        await tx.trainerProfile.update({
          where: { id: trainerProfile.id },
          data: { profileCompletionPercent: completionPercent },
        });
      }

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
      averageRating: reviewsAgg._avg.rating ? Number(reviewsAgg._avg.rating).toFixed(2) : "0.00",
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

export const TrainerProfileService = {
  createTrainerProfile,
  getOwnTrainerProfile,
  getPublicTrainerProfile,
  getAllTrainers,
};
