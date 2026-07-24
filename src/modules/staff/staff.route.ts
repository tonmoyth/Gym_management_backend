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

export const staffRoutes = router;
