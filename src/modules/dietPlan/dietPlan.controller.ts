import { Request, Response } from "express";

import sendResponse from "../../utils/sendResponse";
import { DietPlanService } from "./dietPlan.service";
import { catchAsync } from "../../shared/catchAsync";

const createDietPlan = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const payload = req.body;

  const result = await DietPlanService.createDietPlan(userId, payload);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Diet plan created successfully.",
    data: result,
  });
});

const updateDietPlan = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { id } = req.params;
  const payload = req.body;

  const result = await DietPlanService.updateDietPlan(userId, id as string, payload);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Diet plan updated successfully.",
    data: result,
  });
});

const getMemberDietPlan = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { memberId } = req.params;

  const result = await DietPlanService.getMemberDietPlan(userId, memberId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Diet plan retrieved successfully.",
    data: result,
  });
});

export const DietPlanController = {
  createDietPlan,
  updateDietPlan,
  getMemberDietPlan,
};
