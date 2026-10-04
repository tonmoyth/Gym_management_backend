import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ProgressService } from "./progress.service";


import AppError from "../../errors/AppError";

const createProgress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const role = req.user.role as string;

  const payload = {
    ...req.body,
    workoutLog: req.body.workoutLog || req.body.notes,
    loggedAt: req.body.loggedAt || req.body.recordedAt,
  };
  
  if (req.body.bodyFat !== undefined) {
    payload.measurements = {
      ...(req.body.measurements || {}),
      bodyFat: req.body.bodyFat,
    };
  }

  // Auto-calculate BMI if not provided but weight and height exist
  if (!payload.bmi && payload.weight && payload.measurements?.height) {
    const heightInM = Number(payload.measurements.height) / 100;
    if (heightInM > 0) {
      payload.bmi = Number((Number(payload.weight) / (heightInM * heightInM)).toFixed(1));
    }
  }

  let result;
  if (role === "MEMBER") {
    result = await ProgressService.createSelfProgress(userId, payload);
  } else {
    if (!payload.memberId) {
      throw new AppError(400, "Member ID is required");
    }
    result = await ProgressService.createProgressEntry(userId, payload);
  }

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Progress recorded successfully.",
    data: {
      ...result,
      progress: result,
    },
  });
});

const getMemberProgressHistory = catchAsync(async (req: Request, res: Response) => {
  const trainerUserId = req.user.id as string;
  const { memberId } = req.params;

  const result = await ProgressService.getMemberProgressHistory(trainerUserId, memberId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Member progress history retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

const getMyProgress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;

  const result = await ProgressService.getMyProgress(userId, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Progress history retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

const getTrainerLoggedProgress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;

  const result = await ProgressService.getTrainerLoggedProgress(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer logged progress history retrieved successfully.",
    data: result,
  });
});

export const ProgressController = {
  createProgress,
  getMemberProgressHistory,
  getMyProgress,
  getTrainerLoggedProgress,
};
