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

const getMyDietPlan = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;

  const result = await DietPlanService.getMyDietPlan(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result ? "Diet plan retrieved successfully." : "No diet plan assigned.",
    data: result,
  });
});

const getAssignableMembers = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const businessId = req.query.businessId as string | undefined;

  const result = await DietPlanService.getAssignableMembers(userId, businessId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assignable members retrieved successfully.",
    data: result,
  });
});

const getTrainerDietPlans = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;

  const result = await DietPlanService.getTrainerDietPlans(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Trainer diet plans retrieved successfully.",
    data: result,
  });
});

export const DietPlanController = {
  createDietPlan,
  updateDietPlan,
  getMemberDietPlan,
  getMyDietPlan,
  getAssignableMembers,
  getTrainerDietPlans,
};
