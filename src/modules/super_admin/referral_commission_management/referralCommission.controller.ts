import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { ReferralCommissionService } from './referralCommission.service';

const getAllBusinessReferrals = catchAsync(async (req: Request, res: Response) => {
  const result = await ReferralCommissionService.getAllBusinessReferrals(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Business referrals retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getBusinessReferralById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ReferralCommissionService.getBusinessReferralById(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Business referral retrieved successfully',
    data: result,
  });
});

const creditCommission = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminUser = req.user;
  const reqMeta = {
    ipAddress: req.ip || req.socket.remoteAddress || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };

  const result = await ReferralCommissionService.creditBusinessReferralCommission(
    id as string,
    adminUser,
    req.body,
    reqMeta
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referral commission credited successfully',
    data: result,
  });
});

const getReferralSummaryStats = catchAsync(async (req: Request, res: Response) => {
  const result = await ReferralCommissionService.getReferralSummaryStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Business referral summary stats retrieved successfully',
    data: result,
  });
});

export const ReferralCommissionController = {
  getAllBusinessReferrals,
  getBusinessReferralById,
  creditCommission,
  getReferralSummaryStats,
};
