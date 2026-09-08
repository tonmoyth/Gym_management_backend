import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { BusinessManagementService } from './businessManagement.service';

const getPendingBusinesses = catchAsync(async (req: Request, res: Response) => {
  const result = await BusinessManagementService.getPendingBusinesses(
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Pending businesses retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const approveBusiness = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id; // from checkAuth

  const result = await BusinessManagementService.approveBusiness(id as string, adminId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Business approved successfully',
    data: result,
  });
});

const rejectBusiness = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id; // from checkAuth
  const reason = req.body?.reason;

  const result = await BusinessManagementService.rejectBusiness(
    id as string,
    adminId as string,
    reason
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Business rejected successfully',
    data: result,
  });
});

const suspendBusiness = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id; // from checkAuth
  const reason = req.body?.reason;

  const result = await BusinessManagementService.suspendBusiness(
    id as string,
    adminId as string,
    reason
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Business suspended successfully',
    data: result,
  });
});

const getAllBusinesses = catchAsync(async (req: Request, res: Response) => {
  const result = await BusinessManagementService.getAllBusinesses(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Businesses retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const BusinessManagementController = {
  getPendingBusinesses,
  approveBusiness,
  rejectBusiness,
  suspendBusiness,
  getAllBusinesses,
};
