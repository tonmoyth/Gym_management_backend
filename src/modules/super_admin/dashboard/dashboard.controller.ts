import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { dashboardService } from './dashboard.service';

const getDashboardData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getGlobalMetrics();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Global dashboard metrics retrieved successfully',
    data: result,
  });
});

export const dashboardController = {
  getDashboardData,
};
