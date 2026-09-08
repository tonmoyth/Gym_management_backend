import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { CertificationStatus } from '../../../generated/prisma/enums';
import { pushJob } from '../../../utils/redisQueue';
import {
  certificationSearchableFields,
  certificationFilterableFields,
} from './certificationVerification.constant';

const getPendingCertifications = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, unknown> = { ...query };

  // Map 'search' to 'searchTerm' for QueryBuilder consistency
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  // Business Rule: Ensure client input can NEVER override or bypass status=PENDING
  delete queryParams.status;

  const certificationQueryBuilder = new QueryBuilder(
    prisma.trainerCertification,
    queryParams as any,
    {
      searchableFields: certificationSearchableFields,
      filterableFields: certificationFilterableFields,
    }
  )
    .where({
      status: CertificationStatus.PENDING,
    })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      trainer: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileImage: true,
              isVerified: true,
            },
          },
          businesses: {
            select: {
              id: true,
              isActive: true,
              business: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    });

  const result = await certificationQueryBuilder.execute();

  // Format and sanitize certification and trainer data (never expose sensitive tokens or credentials)
  const formattedData = result.data.map((cert: any) => {
    const businesses =
      cert.trainer?.businesses?.map((tb: any) => ({
        id: tb.business?.id,
        name: tb.business?.name,
        isActive: tb.isActive,
      })) || [];

    return {
      id: cert.id,
      title: cert.title,
      fileUrl: cert.fileUrl,
      certificateUrl: cert.fileUrl,
      issuer: cert.issuer,
      issueDate: cert.issueDate,
      expiryDate: cert.expiryDate,
      credentialId: cert.credentialId,
      credentialUrl: cert.credentialUrl,
      status: cert.status,
      rejectionReason: cert.rejectionReason,
      createdAt: cert.createdAt,
      reviewedAt: cert.reviewedAt,
      trainer: {
        id: cert.trainer?.id,
        userId: cert.trainer?.user?.id,
        name: cert.trainer?.user?.fullName || 'Unknown Trainer',
        fullName: cert.trainer?.user?.fullName || 'Unknown Trainer',
        email: cert.trainer?.user?.email,
        profileImage: cert.trainer?.user?.profileImage,
        verifiedBadge: cert.trainer?.verifiedBadge,
        isVerified: cert.trainer?.user?.isVerified,
        businesses,
      },
    };
  });

  return {
    meta: result.meta,
    data: formattedData,
  };
};

const verifyCertification = async (certificationId: string, adminId: string) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    // 1. Find certification
    const cert = await tx.trainerCertification.findUnique({
      where: { id: certificationId },
      include: {
        trainer: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!cert) {
      throw new AppError(404, 'Certification not found');
    }

    // 2. Validate current status is PENDING
    if (cert.status !== CertificationStatus.PENDING) {
      throw new AppError(
        400,
        `Certification has already been ${cert.status.toLowerCase()}. Only pending certifications can be verified.`
      );
    }

    const now = new Date();

    // 3. Update Certification to VERIFIED
    const updatedCertification = await tx.trainerCertification.update({
      where: { id: certificationId },
      data: {
        status: CertificationStatus.VERIFIED,
        reviewedByAdminId: adminId,
        verifiedBy: adminId,
        verifiedAt: now,
        reviewedAt: now,
      },
    });

    // 4. Update Trainer verified badge
    await tx.trainerProfile.update({
      where: { id: cert.trainerId },
      data: {
        verifiedBadge: true,
      },
    });

    // 5. Update associated user verification status
    if (cert.trainer?.user?.id) {
      await tx.user.update({
        where: { id: cert.trainer.user.id },
        data: {
          isVerified: true,
        },
      });
    }

    return {
      certification: updatedCertification,
      trainer: {
        id: cert.trainerId,
        userId: cert.trainer?.user?.id,
        name: cert.trainer?.user?.fullName,
        email: cert.trainer?.user?.email,
        verifiedBadge: true,
        isVerified: true,
      },
    };
  });

  // 6. Asynchronously trigger in-app notification & email via Redis worker queue
  await pushJob('notification_queue', {
    eventType: 'CERTIFICATION_VERIFIED',
    trainerUserId: transactionResult.trainer.userId,
    trainerEmail: transactionResult.trainer.email,
    trainerName: transactionResult.trainer.name || 'Trainer',
    certificationId: transactionResult.certification.id,
    certificationTitle: transactionResult.certification.title,
  });

  return {
    id: transactionResult.certification.id,
    title: transactionResult.certification.title,
    status: transactionResult.certification.status,
    fileUrl: transactionResult.certification.fileUrl,
    issuer: transactionResult.certification.issuer,
    verifiedAt: transactionResult.certification.verifiedAt,
    reviewedAt: transactionResult.certification.reviewedAt,
    trainer: transactionResult.trainer,
  };
};

const rejectCertification = async (
  certificationId: string,
  adminId: string,
  reason: string
) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    // 1. Find certification
    const cert = await tx.trainerCertification.findUnique({
      where: { id: certificationId },
      include: {
        trainer: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!cert) {
      throw new AppError(404, 'Certification not found');
    }

    // 2. Validate current status is PENDING
    if (cert.status !== CertificationStatus.PENDING) {
      throw new AppError(
        400,
        `Certification has already been ${cert.status.toLowerCase()}. Only pending certifications can be rejected.`
      );
    }

    const now = new Date();

    // 3. Update Certification to REJECTED and save rejection reason
    const updatedCertification = await tx.trainerCertification.update({
      where: { id: certificationId },
      data: {
        status: CertificationStatus.REJECTED,
        rejectionReason: reason.trim(),
        reviewedByAdminId: adminId,
        reviewedAt: now,
      },
    });

    // NOTE: Preserving Trainer's existing badge. Do not unverify trainer on submission rejection.

    return {
      certification: updatedCertification,
      trainer: {
        id: cert.trainerId,
        userId: cert.trainer?.user?.id,
        name: cert.trainer?.user?.fullName,
        email: cert.trainer?.user?.email,
        verifiedBadge: cert.trainer?.verifiedBadge,
      },
    };
  });

  // 4. Asynchronously trigger in-app notification & email via Redis worker queue
  await pushJob('notification_queue', {
    eventType: 'CERTIFICATION_REJECTED',
    trainerUserId: transactionResult.trainer.userId,
    trainerEmail: transactionResult.trainer.email,
    trainerName: transactionResult.trainer.name || 'Trainer',
    certificationId: transactionResult.certification.id,
    certificationTitle: transactionResult.certification.title,
    reason: reason.trim(),
  });

  return {
    id: transactionResult.certification.id,
    title: transactionResult.certification.title,
    status: transactionResult.certification.status,
    fileUrl: transactionResult.certification.fileUrl,
    issuer: transactionResult.certification.issuer,
    rejectionReason: transactionResult.certification.rejectionReason,
    reviewedAt: transactionResult.certification.reviewedAt,
    trainer: transactionResult.trainer,
  };
};

export const CertificationVerificationService = {
  getPendingCertifications,
  verifyCertification,
  rejectCertification,
};
