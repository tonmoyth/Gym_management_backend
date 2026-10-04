import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";
import { ReferralStatus, BookingStatus, NotificationType } from "../../generated/prisma/enums";
import { NotificationService } from "../../utils/notification.service";
import { auditLogger } from "../../utils/auditLogger";
import { pushJob } from "../../utils/redisQueue";

const generateReferralCode = () => {
  return "REF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
};

const getMyReferralCode = async (userId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!memberProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Member profile not found");
  }

  if (memberProfile.referralCode) {
    return { referralCode: memberProfile.referralCode };
  }

  // Generate a unique referral code
  let newCode = "";
  let isUnique = false;
  while (!isUnique) {
    newCode = generateReferralCode();
    const existing = await prisma.memberProfile.findUnique({
      where: { referralCode: newCode },
    });
    if (!existing) {
      isUnique = true;
    }
  }

  await prisma.memberProfile.update({
    where: { id: memberProfile.id },
    data: { referralCode: newCode },
  });

  return { referralCode: newCode };
};

const registerReferral = async (payload: { referralCode: string; email: string; businessId: string }) => {
  const { referralCode, email, businessId } = payload;

  // 1. Find referrer
  const referrer = await prisma.memberProfile.findUnique({
    where: { referralCode },
    include: { user: true },
  });

  if (!referrer) {
    throw new AppError(httpStatus.NOT_FOUND, "Invalid referral code");
  }

  // 2. Find referred user
  const referredUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!referredUser) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "The referred user must complete signup before the referral can be registered"
    );
  }

  // 3. Prevent self-referral
  if (referrer.userId === referredUser.id) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot refer yourself");
  }

  // 4. Prevent duplicate referrals
  const existingReferral = await prisma.memberReferral.findUnique({
    where: { referredUserId: referredUser.id },
  });

  if (existingReferral) {
    throw new AppError(httpStatus.CONFLICT, "This user has already been referred");
  }

  // 5. Tenant Isolation: Verify referrer belongs to the business
  const referrerMembership = await prisma.membership.findFirst({
    where: {
      memberId: referrer.id,
      businessId,
      status: { in: [BookingStatus.ACTIVE, BookingStatus.PENDING_APPROVAL] },
    },
  });

  if (!referrerMembership) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The referrer is not an active member of this business"
    );
  }

  // 6. Get Business Referral Settings
  const referralSettings = await prisma.memberReferralSetting.findUnique({
    where: { businessId },
  });

  if (!referralSettings || !referralSettings.isEnabled) {
    throw new AppError(httpStatus.BAD_REQUEST, "Referrals are currently disabled for this business");
  }

  // 7. Create MemberReferral
  const memberReferral = await prisma.memberReferral.create({
    data: {
      referrerMemberId: referrer.id,
      referredUserId: referredUser.id,
      businessId,
      referralCode,
      commissionAmount: referralSettings.commissionAmount,
      status: ReferralStatus.PENDING,
    },
  });

  return memberReferral;
};

const getMyReferrals = async (userId: string, queryParams: any) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!memberProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Member profile not found");
  }

  const queryBuilder = new QueryBuilder(prisma.memberReferral, queryParams, {
    filterableFields: ["status", "businessId"],
    searchableFields: ["referralCode"],
  })
    .where({ referrerMemberId: memberProfile.id })
    .filter()
    .sort()
    .paginate()
    .include({
      referredUser: {
        select: {
          id: true,
          fullName: true,
          profileImage: true,
          email: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    });

  const result = await queryBuilder.execute();
  return result;
};

const generateBusinessReferralCode = () => {
  return "GYM-" + Math.random().toString(36).substring(2, 7).toUpperCase();
};

const getMyBusinessReferralCode = async (userId: string) => {
  const business = await prisma.business.findUnique({
    where: { ownerId: userId },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "No business found for this owner account");
  }

  if (business.referralCode) {
    return {
      referralCode: business.referralCode,
      businessId: business.id,
      businessName: business.name,
    };
  }

  // Generate unique code
  let newCode = "";
  let isUnique = false;
  while (!isUnique) {
    newCode = generateBusinessReferralCode();
    const existing = await prisma.business.findUnique({
      where: { referralCode: newCode },
    });
    if (!existing) {
      isUnique = true;
    }
  }

  await prisma.business.update({
    where: { id: business.id },
    data: { referralCode: newCode },
  });

  return {
    referralCode: newCode,
    businessId: business.id,
    businessName: business.name,
  };
};

const validateBusinessReferralCode = async (referralCode: string) => {
  const business = await prisma.business.findUnique({
    where: { referralCode: referralCode.trim() },
    select: {
      id: true,
      name: true,
      status: true,
      owner: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  if (!business || business.status !== "ACTIVE" || !business.owner?.isActive) {
    return {
      valid: false,
      message: "Invalid or inactive referral code",
    };
  }

  return {
    valid: true,
    businessName: business.name,
  };
};

const registerBusinessReferral = async (payload: { referralCode: string; businessId: string }) => {
  const { referralCode, businessId } = payload;
  const trimmedCode = referralCode.trim();

  // 1. Find referring business and owner
  const referringBusiness = await prisma.business.findUnique({
    where: { referralCode: trimmedCode },
    include: { owner: true },
  });

  if (!referringBusiness) {
    throw new AppError(httpStatus.NOT_FOUND, "Invalid referral code");
  }

  if (referringBusiness.status !== "ACTIVE") {
    throw new AppError(httpStatus.BAD_REQUEST, "Referring business is not in active status");
  }

  if (!referringBusiness.owner || !referringBusiness.owner.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, "Referring business owner account is inactive");
  }

  // 2. Find newly registered business
  const newBusiness = await prisma.business.findUnique({
    where: { id: businessId },
    include: { owner: true },
  });

  if (!newBusiness) {
    throw new AppError(httpStatus.NOT_FOUND, "Referred business not found");
  }

  // 3. Prevent self-referral
  if (referringBusiness.id === newBusiness.id || referringBusiness.ownerId === newBusiness.ownerId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Self-referral is not allowed. A business cannot refer itself");
  }

  // 4. Prevent duplicate referral for same business
  const existingReferral = await prisma.businessReferral.findUnique({
    where: { referredBusinessId: newBusiness.id },
  });

  if (existingReferral) {
    throw new AppError(httpStatus.CONFLICT, "A referral has already been registered for this business");
  }

  // 5. Create Type-A BusinessReferral
  const businessReferral = await prisma.businessReferral.create({
    data: {
      referrerOwnerId: referringBusiness.ownerId,
      referredBusinessId: newBusiness.id,
      referralCode: trimmedCode,
      commissionAmount: 500.00,
      status: ReferralStatus.PENDING,
    },
    include: {
      referrerOwner: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      referredBusiness: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
        },
      },
    },
  });

  return {
    id: businessReferral.id,
    type: "BUSINESS",
    referralCode: businessReferral.referralCode,
    commissionAmount: Number(businessReferral.commissionAmount),
    commissionStatus: businessReferral.status,
    status: businessReferral.status,
    createdAt: businessReferral.createdAt,
    referrerOwner: businessReferral.referrerOwner,
    referredBusiness: businessReferral.referredBusiness,
  };
};

const getMyBusinessReferrals = async (userId: string, queryParams: any) => {
  const queryBuilder = new QueryBuilder(prisma.businessReferral, queryParams, {
    filterableFields: ["status"],
    searchableFields: ["referralCode"],
  })
    .where({ referrerOwnerId: userId })
    .filter()
    .sort()
    .paginate()
    .include({
      referredBusiness: {
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      },
    });

  const result = await queryBuilder.execute();
  return result;
};

const getOwnerMemberReferrals = async (userId: string, queryParams: any) => {
  // 1. Identify business owned by the authenticated owner
  const business = await prisma.business.findUnique({
    where: { ownerId: userId },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "No business found for this owner account");
  }

  // 2. Strip client-provided businessId to strictly prevent cross-tenant exposure
  const cleanParams = { ...queryParams };
  delete cleanParams.businessId;

  // 3. Query Type-B referrals belonging to owner's business
  const queryBuilder = new QueryBuilder(prisma.memberReferral, cleanParams, {
    filterableFields: ["status", "referralCode"],
    searchableFields: ["referralCode"],
  })
    .where({ businessId: business.id })
    .filter()
    .sort()
    .paginate()
    .include({
      referrerMember: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileImage: true,
            },
          },
        },
      },
      referredUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profileImage: true,
        },
      },
    });

  const result = await queryBuilder.execute();
  return result;
};

const creditMemberReferral = async (
  userId: string,
  referralId: string,
  reqMeta?: { ipAddress?: string; userAgent?: string }
) => {
  // 1. Identify owner's business
  const business = await prisma.business.findUnique({
    where: { ownerId: userId },
  });

  if (!business) {
    throw new AppError(httpStatus.NOT_FOUND, "No business found for this owner account");
  }

  // 2. Find Type-B referral
  const referral = await prisma.memberReferral.findUnique({
    where: { id: referralId },
    include: {
      referrerMember: {
        include: {
          user: true,
        },
      },
      referredUser: true,
    },
  });

  if (!referral) {
    throw new AppError(httpStatus.NOT_FOUND, "Member referral not found");
  }

  // 3. Tenant Isolation Check: Verify referral belongs to this business
  if (referral.businessId !== business.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden: You do not have permission to credit referrals for another business"
    );
  }

  // 4. Verify eligibility / already credited
  if (referral.status === ReferralStatus.CREDITED) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Referral commission has already been credited"
    );
  }

  // 5. Verify referring member exists and is active
  if (!referral.referrerMember || !referral.referrerMember.user) {
    throw new AppError(httpStatus.NOT_FOUND, "Referring member profile not found");
  }

  if (!referral.referrerMember.user.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Referring member user account is inactive. Commission cannot be credited."
    );
  }

  const creditedTimestamp = new Date();
  const commissionAmount = Number(referral.commissionAmount);

  // 6. Concurrency & Transaction Safety: Atomic update
  const updatedReferral = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.memberReferral.updateMany({
      where: {
        id: referralId,
        businessId: business.id,
        status: ReferralStatus.PENDING,
      },
      data: {
        status: ReferralStatus.CREDITED,
        creditedAt: creditedTimestamp,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Referral commission has already been credited or is no longer pending"
      );
    }

    return await tx.memberReferral.findUnique({
      where: { id: referralId },
      include: {
        referrerMember: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profileImage: true,
              },
            },
          },
        },
        referredUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });

  // 7. Audit Logging
  await auditLogger.record({
    actorId: userId,
    action: "MEMBER_REFERRAL_COMMISSION_CREDITED",
    resource: "MEMBER_REFERRAL",
    resourceId: referralId,
    businessId: business.id,
    details: `Business Owner credited Type-B referral commission of ${commissionAmount} BDT to member ${referral.referrerMember.user.fullName || referral.referrerMember.user.email}`,
    metadata: {
      referralId,
      referralCode: referral.referralCode,
      referrerMemberId: referral.referrerMemberId,
      referrerUserId: referral.referrerMember.userId,
      referredUserId: referral.referredUserId,
      businessId: business.id,
      commissionAmount,
      creditedAt: creditedTimestamp,
    },
    ipAddress: reqMeta?.ipAddress,
    userAgent: reqMeta?.userAgent,
  });

  // 8. In-App Notification to Referring Member
  await NotificationService.createNotification(
    referral.referrerMember.userId,
    "Referral Commission Credited! 🎉",
    `Your referral commission of ${commissionAmount.toFixed(2)} BDT for referring a member has been credited to your account by ${business.name}.`,
    NotificationType.PAYOUT,
    {
      referralId,
      businessId: business.id,
      commissionAmount,
      referralCode: referral.referralCode,
    }
  );

  // 9. Redis Queue for Email / Async Notification
  await pushJob("notification_queue", {
    eventType: "MEMBER_REFERRAL_CREDITED",
    referralId,
    referralCode: referral.referralCode,
    referrerUserId: referral.referrerMember.userId,
    referrerEmail: referral.referrerMember.user.email,
    referrerName: referral.referrerMember.user.fullName || "Member",
    businessName: business.name,
    commissionAmount,
    creditedAt: creditedTimestamp,
  });

  return updatedReferral;
};

export const ReferralService = {
  getMyReferralCode,
  registerReferral,
  getMyReferrals,
  getMyBusinessReferralCode,
  validateBusinessReferralCode,
  registerBusinessReferral,
  getMyBusinessReferrals,
  getOwnerMemberReferrals,
  creditMemberReferral,
};

