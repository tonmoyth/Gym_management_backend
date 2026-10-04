import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";

import httpStatus from "http-status";
import { ReferralService } from "./referral.service";

const getMyReferralCode = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await ReferralService.getMyReferralCode(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Referral code retrieved successfully",
    data: result,
  });
});

const registerReferral = catchAsync(async (req: Request, res: Response) => {
  const result = await ReferralService.registerReferral(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Referral registered successfully",
    data: result,
  });
});

const getMyReferrals = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await ReferralService.getMyReferrals(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Referrals retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getMyBusinessReferralCode = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await ReferralService.getMyBusinessReferralCode(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Business referral code retrieved successfully",
    data: result,
  });
});

const validateBusinessReferralCode = catchAsync(async (req: Request, res: Response) => {
  const code = String(req.params.code);
  const result = await ReferralService.validateBusinessReferralCode(code);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.valid ? "Referral code is valid" : "Invalid referral code",
    data: result,
  });
});

const registerBusinessReferral = catchAsync(async (req: Request, res: Response) => {
  const result = await ReferralService.registerBusinessReferral(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Business referral registered successfully",
    data: result,
  });
});

const getMyBusinessReferrals = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await ReferralService.getMyBusinessReferrals(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Business referrals retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getOwnerMemberReferrals = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await ReferralService.getOwnerMemberReferrals(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Member referrals retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const creditMemberReferral = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await ReferralService.creditMemberReferral(userId, id as string, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Referral commission credited successfully",
    data: result,
  });
});

export const ReferralController = {
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

