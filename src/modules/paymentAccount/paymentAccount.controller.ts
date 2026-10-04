import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PaymentAccountService } from './paymentAccount.service';

const createPaymentAccount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await PaymentAccountService.createPaymentAccount(user, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Payment account created successfully.',
    data: result,
  });
});

const getPaymentAccounts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await PaymentAccountService.getPaymentAccounts(user, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment accounts retrieved successfully.',
    meta: result.meta,
    data: result.data,
  });
});

const getPaymentAccountById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const result = await PaymentAccountService.getPaymentAccountById(id as string, user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment account retrieved successfully.',
    data: result,
  });
});

const updatePaymentAccount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const result = await PaymentAccountService.updatePaymentAccount(
    id as string,
    user,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment account updated successfully.',
    data: result,
  });
});

const deletePaymentAccount = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const result = await PaymentAccountService.deletePaymentAccount(id as string, user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment account removed successfully.',
    data: result,
  });
});

const getBusinessPaymentAccounts = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const result = await PaymentAccountService.getBusinessPaymentAccounts(businessId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Business payment accounts retrieved successfully.',
    data: result,
  });
});

const getPlanPaymentAccounts = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params;
  const result = await PaymentAccountService.getPlanPaymentAccounts(planId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Plan and payment accounts retrieved successfully.',
    data: result,
  });
});

export const PaymentAccountController = {
  createPaymentAccount,
  getPaymentAccounts,
  getPaymentAccountById,
  updatePaymentAccount,
  deletePaymentAccount,
  getBusinessPaymentAccounts,
  getPlanPaymentAccounts,
};
