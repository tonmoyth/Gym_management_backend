import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { SubscriptionBillingControlService } from './subscription.service';

const getAllSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionBillingControlService.getAllSubscriptions(
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscriptions retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const updateSubscriptionStatus = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const { status } = req.body;
  const adminId = req.user?.id;

  const result = await SubscriptionBillingControlService.updateSubscriptionStatus(
    businessId as string,
    status,
    adminId as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription status updated successfully',
    data: result,
  });
});

export const SubscriptionBillingControlController = {
  getAllSubscriptions,
  updateSubscriptionStatus,
};
