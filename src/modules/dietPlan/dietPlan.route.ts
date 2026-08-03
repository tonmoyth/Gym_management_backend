import express from 'express';
import { DietPlanController } from './dietPlan.controller';
import validateRequest from '../../middlewares/validateRequest';
import { DietPlanValidations } from './dietPlan.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { USER_ROLE } from '../Business/business.constant';

const router = express.Router();

router.post(
    '/',
    // @ts-ignore
    checkAuth(USER_ROLE.TRAINER),
    validateRequest(DietPlanValidations.createDietPlanValidation),
    DietPlanController.createDietPlan
);

router.patch(
    '/:id',
    // @ts-ignore
    checkAuth(USER_ROLE.TRAINER),
    validateRequest(DietPlanValidations.updateDietPlanValidation),
    DietPlanController.updateDietPlan
);

router.get(
    '/member/:memberId',
    // @ts-ignore
    checkAuth(USER_ROLE.TRAINER),
    validateRequest(DietPlanValidations.getDietPlanValidation),
    DietPlanController.getMemberDietPlan
);

export const dietPlanRoutes = router;
