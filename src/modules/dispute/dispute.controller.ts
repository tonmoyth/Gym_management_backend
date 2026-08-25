import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { DisputeService } from './dispute.service';
import httpStatus from 'http-status';

const createDispute = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const result = await DisputeService.createDispute(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Dispute raised successfully.',
    data: result,
  });
});

const getMyDisputes = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const result = await DisputeService.getMyDisputes(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Disputes retrieved successfully.',
    meta: result.meta,
    data: result.data,
  });
});

export const DisputeController = {
  createDispute,
  getMyDisputes,
};
