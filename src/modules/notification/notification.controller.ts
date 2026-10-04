import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { NotificationService } from './notification.service';
import httpStatus from 'http-status';

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const query = req.query;

  const result = await NotificationService.getMyNotifications(userId, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notifications retrieved successfully.',
    meta: result.meta,
    data: result.data,
  });
});

const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;

  const result = await NotificationService.markNotificationAsRead(userId, id as string, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification marked as read successfully.',
    data: result,
  });
});

const markAllNotificationsAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  const result = await NotificationService.markAllNotificationsAsRead(userId, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All notifications marked as read successfully.',
    data: result,
  });
});

export const NotificationController = {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
