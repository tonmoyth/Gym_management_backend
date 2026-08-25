import { Request, Response } from "express";

import sendResponse from "../../utils/sendResponse";
import { PayoutService } from "./payout.service";
import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync";


const getMyTrainerPayouts = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await PayoutService.getMyTrainerPayouts(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payout history retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

export const PayoutController = {
  getMyTrainerPayouts,
};
