import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { SubscriptionService } from './subscription.service';

const getMySubscription = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id;

  const result = await SubscriptionService.getMySubscription(ownerId, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription information retrieved successfully.',
    data: result,
  });
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody || req.body;
  const sigHeader =
    req.headers['stripe-signature'] ||
    req.headers['x-signature'] ||
    req.headers['x-webhook-signature'];
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : (sigHeader || '');

  const result = await SubscriptionService.handleSubscriptionWebhook(
    signature,
    rawBody,
    req.body,
    {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      headers: req.headers,
    }
  );

  res.status(200).json({
    success: true,
    message: result?.message || 'Subscription webhook processed successfully',
    data: result?.data,
  });
});

const getActivePlans = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.getActivePlans(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Active SaaS subscription plans retrieved successfully.',
    meta: result.meta,
    data: result.data,
  });
});

const getSuperAdminPaymentAccounts = catchAsync(
  async (_req: Request, res: Response) => {
    const result = await SubscriptionService.getSuperAdminPaymentAccounts();

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Active destination payment accounts retrieved successfully.',
      data: result,
    });
  }
);

const getSubscriptionStatus = catchAsync(
  async (req: Request, res: Response) => {
    const ownerId = req.user.id;
    const result = await SubscriptionService.getSubscriptionStatus(ownerId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Business subscription status retrieved successfully.',
      data: result,
    });
  }
);

const submitPayment = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id;
  const result = await SubscriptionService.submitSubscriptionPayment(
    ownerId,
    req.body
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message:
      'Subscription payment submitted successfully and is pending admin verification.',
    data: result,
  });
});

const renewSubscription = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id;
  const result = await SubscriptionService.renewSubscription(ownerId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message:
      'Subscription renewal payment submitted successfully and is pending admin verification.',
    data: result,
  });
});

const getPaymentHistory = catchAsync(async (req: Request, res: Response) => {
  const ownerId = req.user.id;
  const result = await SubscriptionService.getPaymentHistory(ownerId, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription payment history retrieved successfully.',
    meta: result.meta,
    data: result.data,
  });
});

export const SubscriptionController = {
  getMySubscription,
  handleWebhook,
  getActivePlans,
  getSuperAdminPaymentAccounts,
  getSubscriptionStatus,
  submitPayment,
  renewSubscription,
  getPaymentHistory,
};
