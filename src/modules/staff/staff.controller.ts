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

export const StaffController = {
    addStaff
};
