import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { PaymentGatewayOversightService } from './payment.service';

const getGatewayStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentGatewayOversightService.getGatewayStatus();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment gateway status retrieved successfully',
    data: result,
  });
});

const getAllTransactions = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentGatewayOversightService.getAllTransactions(
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Transactions retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const PaymentGatewayOversightController = {
  getGatewayStatus,
  getAllTransactions,
};
