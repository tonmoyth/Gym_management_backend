import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { checkAuth } from '../../middlewares/checkAuth';
import { USER_ROLE } from '../Business/business.constant';
import { StaffValidations } from './staff.validation';
import { StaffController } from './staff.controller';

const router = express.Router();

router.post(
    '/:businessId/staff',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(StaffValidations.addStaffValidation),
    StaffController.addStaff
);

router.get(
    '/:businessId/staff',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(StaffValidations.getStaffListValidation),
    StaffController.getStaffList
);

router.patch(
    '/:businessId/staff/:staffId',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(StaffValidations.updateStaffPermissionValidation),
    StaffController.updateStaffPermission
);

router.delete(
    '/:businessId/staff/:staffId',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(StaffValidations.removeStaffValidation),
    StaffController.removeStaff
);

export const staffRoutes = router;
