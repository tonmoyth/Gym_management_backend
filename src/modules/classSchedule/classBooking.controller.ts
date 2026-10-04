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

const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await ClassBookingService.getMyBookings(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My class bookings retrieved successfully.",
    data: result,
  });
});

const cancelBooking = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const bookingId = req.params.id;
  const result = await ClassBookingService.cancelBooking(userId, bookingId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Class booking cancelled successfully.",
    data: result,
  });
});

export const ClassBookingController = {
  bookClass,
  getMyBookings,
  cancelBooking,
};
