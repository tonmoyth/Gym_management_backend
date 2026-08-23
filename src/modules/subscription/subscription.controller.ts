import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { SubscriptionService } from "./subscription.service";

const getMySubscription = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id;

  const result = await SubscriptionService.getMySubscription(ownerId, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription information retrieved successfully.",
    data: result,
  });
});

export const SubscriptionController = {
  getMySubscription,
};
