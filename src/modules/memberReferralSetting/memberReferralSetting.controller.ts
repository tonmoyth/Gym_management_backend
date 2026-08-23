import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { MemberReferralSettingService } from "./memberReferralSetting.service";

const setReferralSettings = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const ownerId = req.user.id;

  const result = await MemberReferralSettingService.setReferralSettings(
    ownerId,
    businessId as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Referral settings updated successfully.",
    data: result,
  });
});

const getReferralSettings = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const ownerId = req.user.id;

  const result = await MemberReferralSettingService.getReferralSettings(
    ownerId,
    businessId as string
  );

  if (!result) {
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Referral settings not configured.",
      data: null,
    });
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Referral settings retrieved successfully.",
    data: result,
  });
});

export const MemberReferralSettingController = {
  setReferralSettings,
  getReferralSettings,
};
