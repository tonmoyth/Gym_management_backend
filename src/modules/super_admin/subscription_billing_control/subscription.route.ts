import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { SubscriptionBillingControlValidation } from './subscription.validation';
import { SubscriptionBillingControlController } from './subscription.controller';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('SUBSCRIPTION_READ'),
  validateRequest(
    SubscriptionBillingControlValidation.getSubscriptionsQueryValidation
  ),
  SubscriptionBillingControlController.getAllSubscriptions
);

router.patch(
  '/:businessId/status',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('SUBSCRIPTION_MANAGE'),
  validateRequest(
    SubscriptionBillingControlValidation.updateSubscriptionStatusValidation
  ),
  SubscriptionBillingControlController.updateSubscriptionStatus
);

export const subscriptionBillingControlRoutes = router;
