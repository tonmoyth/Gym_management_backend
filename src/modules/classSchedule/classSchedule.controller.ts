import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ClassScheduleService } from "./classSchedule.service";

const createClassSchedule = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const ownerId = req.user.id;

  const result = await ClassScheduleService.createClassSchedule(
    ownerId,
    businessId as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Class schedule created successfully.",
    data: result,
  });
});

const getClassSchedules = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  const result = await ClassScheduleService.getClassSchedules(
    userId,
    role,
    businessId as string,
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Class schedules retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

const getClassScheduleDetails = catchAsync(async (req: Request, res: Response) => {
  const { businessId, id } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  const result = await ClassScheduleService.getClassScheduleDetails(
    userId,
    role,
    businessId as string,
    id as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Class schedule details retrieved successfully.",
    data: result,
  });
});

const updateClassSchedule = catchAsync(async (req: Request, res: Response) => {
  const { businessId, id } = req.params;
  const ownerId = req.user.id;

  const result = await ClassScheduleService.updateClassSchedule(
    ownerId,
    businessId as string,
    id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Class schedule updated successfully.",
    data: result,
  });
});

const cancelClassSchedule = catchAsync(async (req: Request, res: Response) => {
  const { businessId, id } = req.params;
  const ownerId = req.user.id;

  const result = await ClassScheduleService.cancelClassSchedule(
    ownerId,
    businessId as string,
    id as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Class schedule cancelled successfully.",
    data: result,
  });
});

export const ClassScheduleController = {
  createClassSchedule,
  getClassSchedules,
  getClassScheduleDetails,
  updateClassSchedule,
  cancelClassSchedule,
};
