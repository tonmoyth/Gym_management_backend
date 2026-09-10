import express from 'express';
import { Role } from '../../../generated/prisma/enums';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import validateRequest from '../../../middlewares/validateRequest';
import { RolePermissionValidations } from './rolePermissionManagement.validation';
import { RolePermissionManagementController } from './rolePermissionManagement.controller';

const router = express.Router();

router.post(
    '/',
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    checkPermission('STAFF_MANAGE'),
    validateRequest(RolePermissionValidations.createStaffValidation),
    RolePermissionManagementController.createStaff
);

router.get(
    '/',
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
    checkPermission('STAFF_READ'),
    RolePermissionManagementController.getStaffList
);

router.get(
    '/permissions',
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
    checkPermission('STAFF_READ'),
    RolePermissionManagementController.getAllPermissions
);

router.patch(
    '/:id',
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    checkPermission('STAFF_MANAGE'),
    validateRequest(RolePermissionValidations.updateStaffPermissionsValidation),
    RolePermissionManagementController.updateStaffPermission
);

router.delete(
    '/:id',
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    checkPermission('STAFF_MANAGE'),
    validateRequest(RolePermissionValidations.staffIdParamValidation),
    RolePermissionManagementController.removeStaff
);

export const rolePermissionManagementRoutes = router;
