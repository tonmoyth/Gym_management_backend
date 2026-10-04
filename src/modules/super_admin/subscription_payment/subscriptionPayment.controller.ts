import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { SubscriptionPaymentService } from './subscriptionPayment.service';

const getAllSubscriptionPayments = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await SubscriptionPaymentService.getAllSubscriptionPayments(req.query);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'SaaS subscription payments retrieved successfully.',
      meta: result.meta,
      data: result.data,
    });
  }
);

const getSubscriptionPaymentById = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result =
      await SubscriptionPaymentService.getSubscriptionPaymentById(id as string);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'SaaS subscription payment retrieved successfully.',
      data: result,
    });
  }
);

const approvePayment = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.id;
  const { id } = req.params;
  const result = await SubscriptionPaymentService.approvePayment(
    id as string,
    adminId
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription payment approved and business activated successfully.',
    data: result,
  });
});

const rejectPayment = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.id;
  const { id } = req.params;
  const result = await SubscriptionPaymentService.rejectPayment(
    id as string,
    adminId,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Subscription payment rejected successfully.',
    data: result,
  });
});

export const SubscriptionPaymentController = {
  getAllSubscriptionPayments,
  getSubscriptionPaymentById,
  approvePayment,
  rejectPayment,
};
