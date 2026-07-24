import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { StaffService } from './staff.service';

const addStaff = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const ownerId = req.user.id;
    const result = await StaffService.addStaff(businessId, ownerId, req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: 'Business staff added successfully.',
        data: result
    });
});

const getStaffList = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const ownerId = req.user.id;
    const result = await StaffService.getStaffList(businessId, ownerId, req.query);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Business staff retrieved successfully.',
        meta: result.meta,
        data: result.data
    });
});

const updateStaffPermission = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const staffId = req.params.staffId as string;
    const ownerId = req.user.id;

    const result = await StaffService.updateStaffPermission(businessId, staffId, ownerId, req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Staff permission updated successfully.',
        data: result
    });
});

export const StaffController = {
    addStaff,
    getStaffList,
    updateStaffPermission
};
