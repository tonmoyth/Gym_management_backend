import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";

import httpStatus from "http-status";
import { ClassBookingService } from "./classBooking.service";

const bookClass = catchAsync(async (req: Request, res: Response) => {
  const classScheduleId = req.params.id;
  const userId = req.user.id;

  const result = await ClassBookingService.bookClass(userId, classScheduleId as string);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Class booked successfully.",
    data: result,
  });
});

export const ClassBookingController = {
  bookClass,
};
