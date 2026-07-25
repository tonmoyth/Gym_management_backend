import { prisma } from '../../lib/prisma';
import AppError from '../../errors/AppError';
import { Gender } from '../../generated/prisma/client';
import { uploadToCloudinary } from '../../utils/cloudinary';
import fs from 'fs';

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

const upsertTrainerProfile = async (
  userId: string,
  payload: IUpsertTrainerProfilePayload,
  profilePhoto?: Express.Multer.File,
  certificationFiles: Express.Multer.File[] = []
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
      profilePhotoUrl = await uploadToCloudinary(profilePhoto.path, 'trainer-profiles');
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
        const url = await uploadToCloudinary(file.path, 'trainer-certifications');
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
  const uniqueSpecializationIds = Array.from(new Set(payload.specializationIds || []));

  // 4. Prisma Transaction
  const result = await prisma.$transaction(async (tx) => {
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
      select: { id: true }
    });

    // Update User Profile Photo
    if (profilePhotoUrl !== user.profileImage) {
      await tx.user.update({
        where: { id: userId },
        data: { profileImage: profilePhotoUrl }
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
          data: uniqueSpecializationIds.map(tagId => ({
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
        const mappedCertifications = payload.certifications.map(cert => {
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
        const invalidCerts = mappedCertifications.filter(c => !c.fileUrl);
        if (invalidCerts.length > 0) {
          throw new AppError(400, "Missing file upload or fileUrl for one or more certifications.");
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
      }
    });

    if (updatedProfile) {
      if (updatedProfile.bio && updatedProfile.bio.trim().length > 0) completionPercent += 20;
      if (updatedProfile.user?.profileImage) completionPercent += 20;
      if (updatedProfile.gender) completionPercent += 10;
      if (updatedProfile.specializations.length > 0) completionPercent += 25;
      if (updatedProfile.certifications.length > 0) completionPercent += 25;

      // Update completion percent
      await tx.trainerProfile.update({
        where: { id: trainerProfile.id },
        data: { profileCompletionPercent: completionPercent }
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
          }
        },
        specializations: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
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
            verificationStatus: true
          }
        }
      }
    });
    
    if (finalProfile) {
      return {
        ...finalProfile,
        profilePhoto: finalProfile.user?.profileImage || null,
        user: undefined, // Expose cleanly via `profilePhoto`
        specializations: finalProfile.specializations.map(s => s.tag),
      };
    }
    
    return finalProfile;
  });

  return result;
};

export const TrainerProfileService = {
  upsertTrainerProfile,
};
