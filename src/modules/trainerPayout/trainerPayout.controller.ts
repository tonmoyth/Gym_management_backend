import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { TrainerPayoutService } from "./trainerPayout.service";

const createOrUpdatePayout = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const ownerId = req.user.id;

  const result = await TrainerPayoutService.createOrUpdatePayout(
    ownerId as string,
    businessId as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer payout saved successfully.",
    data: result,
  });
});

const getPayouts = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const ownerId = req.user.id;

  const result = await TrainerPayoutService.getPayouts(
    ownerId as string,
    businessId as string,
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer payouts retrieved successfully.",
    meta: result.meta,
    data: {
      summary: result.summary,
      data: result.data,
    } as any,
  });
});

const markPaid = catchAsync(async (req: Request, res: Response) => {
  const { businessId, id } = req.params;
  const ownerId = req.user.id;

  const result = await TrainerPayoutService.markPaid(
    ownerId as string,
    businessId as string,
    id as string,
    req.body.transactionReference
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer payout marked as paid successfully.",
    data: result,
  });
});

export const TrainerPayoutController = {
  createOrUpdatePayout,
  getPayouts,
  markPaid,
};
