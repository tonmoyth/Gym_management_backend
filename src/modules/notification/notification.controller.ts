import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { NotificationService } from './notification.service';

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const query = req.query;

  const result = await NotificationService.getMyNotifications(userId, query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notifications retrieved successfully.',
    meta: result.meta,
    data: result.data,
  });
});

const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;

  const result = await NotificationService.markNotificationAsRead(userId, id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notification marked as read successfully.',
    data: result,
  });
});

export const NotificationController = {
  getMyNotifications,
  markNotificationAsRead,
};
