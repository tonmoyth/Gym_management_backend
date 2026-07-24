import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { BusinessService } from './business.service';

const createBusiness = catchAsync(async (req: Request, res: Response) => {
    const ownerId = req.user.id;
    const result = await BusinessService.createBusiness(ownerId, req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: 'Business profile created successfully.',
        data: result
    });
});

const getBusinesses = catchAsync(async (req: Request, res: Response) => {
    const result = await BusinessService.getAllBusinesses(req.query);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Businesses retrieved successfully.',
        meta: result.meta,
        data: result.data
    });
});

const getBusiness = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await BusinessService.getBusinessById(id as string);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Business retrieved successfully.',
        data: result
    });
});

const updateBusiness = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ownerId = req.user.id;
    const result = await BusinessService.updateBusiness(id as string, ownerId, req.body, req.files);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Business profile updated successfully.',
        data: result
    });
});

const getMyBusiness = catchAsync(async (req: Request, res: Response) => {
    const ownerId = req.user.id;
    const result = await BusinessService.getMyBusiness(ownerId);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Business profile retrieved successfully.',
        data: result
    });
});

const getBusinessDashboard = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ownerId = req.user.id;
    const result = await BusinessService.getBusinessDashboard(id as string, ownerId);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Business dashboard retrieved successfully.',
        data: result
    });
});

export const BusinessController = {
    createBusiness,
    getBusinesses,
    getBusiness,
    updateBusiness,
    getMyBusiness,
    getBusinessDashboard
};
