import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { MembershipPlanService } from './membershipPlan.service';

const createMembershipPlan = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const ownerId = req.user.id;
    const result = await MembershipPlanService.createMembershipPlan(businessId, ownerId, req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: 'Membership plan created successfully.',
        data: result
    });
});

const getMembershipPlans = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const result = await MembershipPlanService.getMembershipPlans(businessId, req.query);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Membership plans retrieved successfully.',
        meta: result.meta,
        data: result.data
    });
});

const getMembershipPlan = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const planId = req.params.planId as string;
    const result = await MembershipPlanService.getMembershipPlan(businessId, planId);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Membership plan retrieved successfully.',
        data: result
    });
});

const updateMembershipPlan = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const planId = req.params.planId as string;
    const ownerId = req.user.id;
    const result = await MembershipPlanService.updateMembershipPlan(businessId, planId, ownerId, req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Membership plan updated successfully.',
        data: result
    });
});

const archiveMembershipPlan = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const planId = req.params.planId as string;
    const ownerId = req.user.id;
    const result = await MembershipPlanService.archiveMembershipPlan(businessId, planId, ownerId);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Membership plan archived successfully.',
        data: result
    });
});

export const MembershipPlanController = {
    createMembershipPlan,
    getMembershipPlans,
    getMembershipPlan,
    updateMembershipPlan,
    archiveMembershipPlan
};
