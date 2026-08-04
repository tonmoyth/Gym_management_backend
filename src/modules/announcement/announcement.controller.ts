import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AnnouncementService } from "./announcement.service";

const createAnnouncement = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const ownerId = req.user.id;

  const result = await AnnouncementService.createAnnouncement(
    ownerId as string,
    businessId as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Announcement posted successfully.",
    data: result,
  });
});

const getAnnouncements = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const userId = req.user.id;
  const role = req.user.role; // Assuming role is available on req.user

  const result = await AnnouncementService.getAnnouncements(
    userId as string,
    role as string,
    businessId as string,
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Announcements retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

export const AnnouncementController = {
  createAnnouncement,
  getAnnouncements,
};
