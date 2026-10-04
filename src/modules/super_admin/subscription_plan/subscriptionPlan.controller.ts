import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { SubscriptionPlanService } from './subscriptionPlan.service';

const createPlan = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.id;
  const result = await SubscriptionPlanService.createPlan(adminId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'SaaS subscription plan created successfully.',
    data: result,
  });
});

const getAllPlans = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionPlanService.getAllPlans(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'SaaS subscription plans retrieved successfully.',
    meta: result.meta,
    data: result.data,
  });
});

const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionPlanService.getPlanById(id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'SaaS subscription plan retrieved successfully.',
    data: result,
  });
});

const updatePlan = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.id;
  const { id } = req.params;
  const result = await SubscriptionPlanService.updatePlan(
    id as string,
    adminId,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'SaaS subscription plan updated successfully.',
    data: result,
  });
});

const deleteOrDeactivatePlan = catchAsync(
  async (req: Request, res: Response) => {
    const adminId = req.user.id;
    const { id } = req.params;
    const result = await SubscriptionPlanService.deleteOrDeactivatePlan(
      id as string,
      adminId
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: `SaaS subscription plan ${result.action.toLowerCase()} successfully.`,
      data: result.plan,
    });
  }
);

export const SubscriptionPlanController = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deleteOrDeactivatePlan,
};
