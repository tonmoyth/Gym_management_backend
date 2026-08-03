import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import httpStatus from "http-status";
import { memberProfileService } from "./memberProfile.service";

const setFitnessGoal = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { fitnessGoalTagId } = req.body;

  const result = await memberProfileService.setFitnessGoal(userId, fitnessGoalTagId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fitness goal set successfully.",
    data: result,
  });
});

const getProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await memberProfileService.getProfile(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Member profile retrieved successfully.",
    data: result,
  });
});

const getRecommendations = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await memberProfileService.getRecommendations(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Recommendations retrieved successfully.",
    data: result,
  });
});

export const memberProfileController = {
  setFitnessGoal,
  getProfile,
  getRecommendations,
};
