import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";

const setReferralSettings = async (ownerId: string, businessId: string, payload: { rewardType: string, rewardValue: number }) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const commissionAmount = payload.rewardType === "FIXED_AMOUNT" ? payload.rewardValue : 0;
  const referralDiscount = payload.rewardType === "PERCENTAGE" ? payload.rewardValue : null;

  const referralSetting = await prisma.memberReferralSetting.upsert({
    where: { businessId },
    update: {
      commissionAmount,
      referralDiscount,
    },
    create: {
      businessId,
      commissionAmount,
      referralDiscount,
    },
  });

  return referralSetting;
};

const getReferralSettings = async (ownerId: string, businessId: string) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const referralSetting = await prisma.memberReferralSetting.findUnique({
    where: { businessId },
    select: {
      id: true,
      businessId: true,
      commissionAmount: true,
      referralDiscount: true,
      isEnabled: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  return referralSetting;
};

export const MemberReferralSettingService = {
  setReferralSettings,
  getReferralSettings,
};
