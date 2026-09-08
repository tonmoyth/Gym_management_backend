import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { SubscriptionBillingControlValidation } from './subscription.validation';
import { SubscriptionBillingControlController } from './subscription.controller';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(
    SubscriptionBillingControlValidation.getSubscriptionsQueryValidation
  ),
  SubscriptionBillingControlController.getAllSubscriptions
);

router.patch(
  '/:businessId/status',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(
    SubscriptionBillingControlValidation.updateSubscriptionStatusValidation
  ),
  SubscriptionBillingControlController.updateSubscriptionStatus
);

export const subscriptionBillingControlRoutes = router;
