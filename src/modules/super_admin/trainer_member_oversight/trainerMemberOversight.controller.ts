import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { TrainerMemberOversightService } from './trainerMemberOversight.service';

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await TrainerMemberOversightService.getAllUsers(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Users retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const updateAccountStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id;
  const { status } = req.body;

  const result = await TrainerMemberOversightService.updateAccountStatus(
    id as string,
    adminId as string,
    status
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User status updated successfully',
    data: result,
  });
});

export const TrainerMemberOversightController = {
  getAllUsers,
  updateAccountStatus,
};
