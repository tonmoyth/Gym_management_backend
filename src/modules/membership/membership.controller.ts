import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { membershipService } from "./membership.service";

const createMembership = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { planId } = req.body;

  const result = await membershipService.createMembership(userId, planId);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Membership booking created successfully.",
    data: result,
  });
});

const getMyMemberships = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const queryParams = req.query;

  const result = await membershipService.getMyMemberships(userId, queryParams);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Memberships fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getMembershipById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const id = req.params.id;

  const result = await membershipService.getMembershipById(userId, id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Membership fetched successfully",
    data: result,
  });
});

const upgradeMembership = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const id = req.params.id;
  const { newPlanId } = req.body;

  const result = await membershipService.upgradeMembership(userId, id as string, newPlanId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Membership plan change scheduled successfully.",
    data: result,
  });
});

const cancelMembership = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const id = req.params.id;

  const result = await membershipService.cancelMembership(userId, id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Membership cancelled successfully.",
    data: result,
  });
});

const approveMembership = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const id = req.params.id;

  const result = await membershipService.approveMembership(userId, id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Membership approved successfully.",
    data: result,
  });
});

const rejectMembership = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const id = req.params.id;
  const { reason } = req.body;

  const result = await membershipService.rejectMembership(userId, id as string, reason);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Membership rejected successfully.",
    data: result,
  });
});

export const membershipController = {
  createMembership,
  getMyMemberships,
  getMembershipById,
  upgradeMembership,
  cancelMembership,
  approveMembership,
  rejectMembership,
};
