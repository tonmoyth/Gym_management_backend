import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { SystemAnnouncementService } from './systemAnnouncement.service';

const createAnnouncement = catchAsync(async (req: Request, res: Response) => {
  const superAdminId = req.user.id;
  const result = await SystemAnnouncementService.createAnnouncement(req.body, superAdminId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'System-wide announcement dispatched successfully.',
    data: result,
  });
});

const getAnnouncements = catchAsync(async (req: Request, res: Response) => {
  const result = await SystemAnnouncementService.getAnnouncements(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'System announcements retrieved successfully.',
    meta: result.meta,
    data: result.data,
  });
});

export const SystemAnnouncementController = {
  createAnnouncement,
  getAnnouncements,
};
