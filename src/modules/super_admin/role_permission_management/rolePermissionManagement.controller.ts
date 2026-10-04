import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { RolePermissionManagementService } from './rolePermissionManagement.service';
import { PERMISSION_SCOPE_MAP } from './rolePermissionManagement.constant';
import { generateRandomString } from 'better-auth/crypto';

const createStaff = catchAsync(async (req: Request, res: Response) => {
    const superAdminId = req.user.id;
    const rawBody = req.body || {};

    const name = (rawBody.name || rawBody.fullName || '').trim();
    let role = rawBody.role;
    let permissions = rawBody.permissions;
    const password = rawBody.password || generateRandomString(12);

    if (rawBody.permissionScope && (!permissions || permissions.length === 0)) {
        const scopeConfig =
            PERMISSION_SCOPE_MAP[rawBody.permissionScope] ||
            PERMISSION_SCOPE_MAP.SUPPORT;
        if (!role) {
            role = scopeConfig.role;
        }
        permissions = scopeConfig.permissions;
    }

    if (!role) {
        role = 'STAFF';
    }
    if (!permissions || permissions.length === 0) {
        permissions = PERMISSION_SCOPE_MAP.SUPPORT.permissions;
    }

    const payload = {
        name,
        email: rawBody.email,
        password,
        role,
        permissions
    };

    const result = await RolePermissionManagementService.createStaff(payload, superAdminId);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Platform Staff/Admin account created successfully',
        data: result
    });
});

const getStaffList = catchAsync(async (req: Request, res: Response) => {
    const result = await RolePermissionManagementService.getStaffList(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Platform staff accounts retrieved successfully',
        meta: result.meta,
        data: result.data
    });
});

const updateStaffPermission = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const superAdminId = req.user.id;
    const result = await RolePermissionManagementService.updateStaffPermission(
        id,
        req.body,
        superAdminId
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Platform staff permissions updated successfully',
        data: result
    });
});

const removeStaff = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const superAdminId = req.user.id;
    const result = await RolePermissionManagementService.removeStaff(id, superAdminId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Platform Staff/Admin account deactivated successfully',
        data: result
    });
});

const getAllPermissions = catchAsync(async (req: Request, res: Response) => {
    const result = RolePermissionManagementService.getAllPermissions();

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Platform permissions retrieved successfully',
        data: result
    });
});

export const RolePermissionManagementController = {
    createStaff,
    getStaffList,
    getAllPermissions,
    updateStaffPermission,
    removeStaff
};
