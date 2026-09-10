import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { QueryBuilder } from "../../utils/queryBuilder";
import { ReferralStatus, BookingStatus } from "../../generated/prisma/enums";

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

export const ReferralService = {
  getMyReferralCode,
  registerReferral,
  getMyReferrals,
  getMyBusinessReferralCode,
  validateBusinessReferralCode,
  registerBusinessReferral,
  getMyBusinessReferrals,
};

