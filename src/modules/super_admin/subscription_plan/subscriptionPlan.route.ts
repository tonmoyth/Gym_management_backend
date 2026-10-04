import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import validateRequest from '../../../middlewares/validateRequest';
import { Role } from '../../../generated/prisma/enums';
import { SubscriptionPlanController } from './subscriptionPlan.controller';
import { SubscriptionPlanValidation } from './subscriptionPlan.validation';

const router = express.Router();

router.post(
  '/',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(SubscriptionPlanValidation.createSubscriptionPlanValidation),
  SubscriptionPlanController.createPlan
);

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN),
  SubscriptionPlanController.getAllPlans
);

router.get(
  '/:id',
  checkAuth(Role.SUPER_ADMIN),
  SubscriptionPlanController.getPlanById
);

router.patch(
  '/:id',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(SubscriptionPlanValidation.updateSubscriptionPlanValidation),
  SubscriptionPlanController.updatePlan
);

router.delete(
  '/:id',
  checkAuth(Role.SUPER_ADMIN),
  SubscriptionPlanController.deleteOrDeactivatePlan
);

export const adminSubscriptionPlanRoutes = router;
