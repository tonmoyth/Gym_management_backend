import httpStatus from 'http-status';
import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { ReferralStatus, NotificationType } from '../../../generated/prisma/enums';
import { auditLogger } from '../../../utils/auditLogger';
import { NotificationService } from '../../../utils/notification.service';
import { pushJob } from '../../../utils/redisQueue';
import {
  businessReferralFilterableFields,
  businessReferralSearchableFields,
  DEFAULT_BUSINESS_REFERRAL_COMMISSION,
} from './referralCommission.constant';

interface ICreditPayload {
  commissionAmount?: number;
  payoutReference?: string;
  notes?: string;
}

interface IRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const formatBusinessReferral = (item: any) => {
  return {
    id: item.id,
    type: 'BUSINESS',
    referralCode: item.referralCode,
    commissionAmount: Number(item.commissionAmount),
    commissionStatus: item.status,
    status: item.status,
    payoutReference: item.payoutReference || null,
    notes: item.notes || null,
    creditedAt: item.creditedAt || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    creditedBy: item.creditedBy
      ? {
          id: item.creditedBy.id,
          fullName: item.creditedBy.fullName,
          email: item.creditedBy.email,
        }
      : null,
    referrerOwner: item.referrerOwner
      ? {
          id: item.referrerOwner.id,
          fullName: item.referrerOwner.fullName,
          email: item.referrerOwner.email,
          profileImage: item.referrerOwner.profileImage || null,
          isActive: item.referrerOwner.isActive,
        }
      : null,
    referredBusiness: item.referredBusiness
      ? {
          id: item.referredBusiness.id,
          name: item.referredBusiness.name,
          email: item.referredBusiness.email,
          phone: item.referredBusiness.phone,
          status: item.referredBusiness.status,
          createdAt: item.referredBusiness.createdAt,
          owner: item.referredBusiness.owner
            ? {
                id: item.referredBusiness.owner.id,
                fullName: item.referredBusiness.owner.fullName,
                email: item.referredBusiness.owner.email,
              }
            : null,
        }
      : null,
  };
};

const getAllBusinessReferrals = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, unknown> = { ...query };

  // Handle date range filtering on createdAt
  const dateFilters: Record<string, unknown> = {};
  if (queryParams.startDate) {
    dateFilters.gte = new Date(queryParams.startDate as string);
    delete queryParams.startDate;
  }
  if (queryParams.endDate) {
    const end = new Date(queryParams.endDate as string);
    end.setHours(23, 59, 59, 999);
    dateFilters.lte = end;
    delete queryParams.endDate;
  }

  const queryBuilder = new QueryBuilder(
    prisma.businessReferral,
    queryParams as any,
    {
      searchableFields: businessReferralSearchableFields,
      filterableFields: businessReferralFilterableFields,
    }
  );

  queryBuilder.search().filter().sort().paginate();

  if (Object.keys(dateFilters).length > 0) {
    queryBuilder.where({
      createdAt: dateFilters,
    });
  }

  queryBuilder.include({
    referrerOwner: {
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true,
        isActive: true,
      },
    },
    referredBusiness: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    },
    creditedBy: {
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    },
  });

  const rawResult = await queryBuilder.execute();

  return {
    meta: rawResult.meta,
    data: (rawResult.data || []).map(formatBusinessReferral),
  };
};

const getBusinessReferralById = async (id: string) => {
  const referral = await prisma.businessReferral.findUnique({
    where: { id },
    include: {
      referrerOwner: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profileImage: true,
          isActive: true,
        },
      },
      referredBusiness: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      creditedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  if (!referral) {
    throw new AppError(httpStatus.NOT_FOUND, 'Business referral not found');
  }

  return formatBusinessReferral(referral);
};

const creditBusinessReferralCommission = async (
  id: string,
  adminUser: { id: string; email: string; fullName?: string },
  payload: ICreditPayload,
  reqMeta?: IRequestMeta
) => {
  // 1. Verify referral exists
  const referral = await prisma.businessReferral.findUnique({
    where: { id },
    include: {
      referrerOwner: true,
      referredBusiness: true,
    },
  });

  if (!referral) {
    throw new AppError(httpStatus.NOT_FOUND, 'Business referral not found');
  }

  // 2. Verify referral is pending
  if (referral.status === ReferralStatus.CREDITED) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Referral commission has already been credited'
    );
  }

  // 3. Verify referring owner exists and is active
  if (!referral.referrerOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Referring business owner not found');
  }

  if (!referral.referrerOwner.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Referring business owner account is inactive. Commission cannot be credited.'
    );
  }

  // 4. Verify referred business exists
  if (!referral.referredBusiness) {
    throw new AppError(httpStatus.NOT_FOUND, 'Referred business not found');
  }

  // 5. Determine commission amount
  const finalCommissionAmount =
    payload.commissionAmount !== undefined && payload.commissionAmount > 0
      ? payload.commissionAmount
      : Number(referral.commissionAmount) || DEFAULT_BUSINESS_REFERRAL_COMMISSION;

  if (finalCommissionAmount <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid commission amount');
  }

  // 6. Generate payout reference if not provided
  const payoutRef =
    payload.payoutReference?.trim() ||
    `REF-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const creditedTimestamp = new Date();

  // 7. Atomic Prisma Transaction with concurrency protection
  const updatedReferral = await prisma.$transaction(async (tx) => {
    // Atomic update condition: only update if status is still PENDING
    const updateResult = await tx.businessReferral.updateMany({
      where: {
        id,
        status: ReferralStatus.PENDING,
      },
      data: {
        status: ReferralStatus.CREDITED,
        commissionAmount: finalCommissionAmount,
        creditedAt: creditedTimestamp,
        creditedById: adminUser.id,
        payoutReference: payoutRef,
        notes: payload.notes?.trim() || null,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Referral commission has already been credited or is no longer pending'
      );
    }

    return tx.businessReferral.findUnique({
      where: { id },
      include: {
        referrerOwner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
            isActive: true,
          },
        },
        referredBusiness: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        creditedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  });

  // 8. Record Audit Log (traceable financial action)
  await auditLogger.record({
    actorId: adminUser.id,
    action: 'BUSINESS_REFERRAL_COMMISSION_CREDITED',
    resource: 'BUSINESS_REFERRAL',
    resourceId: id,
    businessId: referral.referredBusinessId,
    details: `Super Admin credited referral commission of ${finalCommissionAmount} BDT to Business Owner ${referral.referrerOwner.fullName || referral.referrerOwner.email} (Ref: ${payoutRef})`,
    metadata: {
      referralId: id,
      referralCode: referral.referralCode,
      referrerOwnerId: referral.referrerOwnerId,
      referrerOwnerEmail: referral.referrerOwner.email,
      referredBusinessId: referral.referredBusinessId,
      referredBusinessName: referral.referredBusiness.name,
      commissionAmount: finalCommissionAmount,
      payoutReference: payoutRef,
      creditedAt: creditedTimestamp,
      notes: payload.notes || null,
    },
    ipAddress: reqMeta?.ipAddress,
    userAgent: reqMeta?.userAgent,
  });

  // 9. Send In-App Notification to Referring Business Owner
  await NotificationService.createNotification(
    referral.referrerOwnerId,
    'Referral Commission Credited! 🎉',
    `Your referral commission of ${finalCommissionAmount} BDT for referring ${referral.referredBusiness.name} has been credited to your account (Ref: ${payoutRef}).`,
    NotificationType.PAYOUT,
    {
      referralId: id,
      commissionAmount: finalCommissionAmount,
      payoutReference: payoutRef,
      referredBusinessName: referral.referredBusiness.name,
    }
  );

  // 10. Push Redis Queue Job for Email & Async Processing
  await pushJob('notification_queue', {
    eventType: 'BUSINESS_REFERRAL_CREDITED',
    referralId: id,
    referralCode: referral.referralCode,
    referrerOwnerId: referral.referrerOwnerId,
    referrerEmail: referral.referrerOwner.email,
    referrerName: referral.referrerOwner.fullName || 'Valued Business Owner',
    referredBusinessName: referral.referredBusiness.name,
    commissionAmount: finalCommissionAmount,
    payoutReference: payoutRef,
    creditedAt: creditedTimestamp,
  });

  return formatBusinessReferral(updatedReferral);
};

const getReferralSummaryStats = async () => {
  const [totalReferrals, pendingCount, creditedCount, creditedSum, pendingSum] =
    await Promise.all([
      prisma.businessReferral.count(),
      prisma.businessReferral.count({ where: { status: ReferralStatus.PENDING } }),
      prisma.businessReferral.count({ where: { status: ReferralStatus.CREDITED } }),
      prisma.businessReferral.aggregate({
        where: { status: ReferralStatus.CREDITED },
        _sum: { commissionAmount: true },
      }),
      prisma.businessReferral.aggregate({
        where: { status: ReferralStatus.PENDING },
        _sum: { commissionAmount: true },
      }),
    ]);

  return {
    totalReferrals,
    pendingReferrals: pendingCount,
    creditedReferrals: creditedCount,
    totalCommissionPaid: Number(creditedSum._sum.commissionAmount) || 0,
    pendingCommissionAmount: Number(pendingSum._sum.commissionAmount) || 0,
  };
};

export const ReferralCommissionService = {
  getAllBusinessReferrals,
  getBusinessReferralById,
  creditBusinessReferralCommission,
  getReferralSummaryStats,
};
