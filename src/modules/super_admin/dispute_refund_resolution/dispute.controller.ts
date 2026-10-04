import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { DisputeRefundResolutionService } from './dispute.service';

const getAllDisputes = catchAsync(async (req: Request, res: Response) => {
  const result = await DisputeRefundResolutionService.getAllDisputes(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Disputes retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getDisputeById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await DisputeRefundResolutionService.getDisputeById(
    id as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Dispute retrieved successfully',
    data: result,
  });
});

const resolveDispute = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id as string;
  const rawBody = req.body || {};

  let resolution = rawBody.resolution;
  const reason = (rawBody.reason || rawBody.resolutionNote || '').trim();

  if (!resolution) {
    if (rawBody.status === 'DISMISSED') {
      resolution = 'DISMISSAL';
    } else if (rawBody.refundAmount || rawBody.paymentId) {
      resolution = 'REFUND';
    } else {
      resolution = 'WARNING';
    }
  }

  const payload = {
    resolution,
    reason,
    paymentId: rawBody.paymentId,
    accountAction: rawBody.accountAction,
    targetUserId: rawBody.targetUserId,
  };

  const result = await DisputeRefundResolutionService.resolveDispute(
    id as string,
    adminId,
    payload
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Dispute resolved successfully',
    data: result,
  });
});

export const DisputeRefundResolutionController = {
  getAllDisputes,
  getDisputeById,
  resolveDispute,
};
