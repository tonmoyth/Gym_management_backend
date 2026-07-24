import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { checkAuth } from '../../middlewares/checkAuth';
import { USER_ROLE } from '../Business/business.constant';
import { MembershipPlanValidations } from './membershipPlan.validation';
import { MembershipPlanController } from './membershipPlan.controller';

const router = express.Router();

router.post(
    '/:businessId/plans',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(MembershipPlanValidations.createMembershipPlanValidation),
    MembershipPlanController.createMembershipPlan
);

router.get(
    '/:businessId/plans',
    validateRequest(MembershipPlanValidations.getMembershipPlansValidation),
    MembershipPlanController.getMembershipPlans
);

router.get(
    '/:businessId/plans/:planId',
    validateRequest(MembershipPlanValidations.getMembershipPlanValidation),
    MembershipPlanController.getMembershipPlan
);

router.patch(
    '/:businessId/plans/:planId',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(MembershipPlanValidations.updateMembershipPlanValidation),
    MembershipPlanController.updateMembershipPlan
);

router.patch(
    '/:businessId/plans/:planId/archive',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(MembershipPlanValidations.archiveMembershipPlanValidation),
    MembershipPlanController.archiveMembershipPlan
);

export const membershipPlanRoutes = router;
