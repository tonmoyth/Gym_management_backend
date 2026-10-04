import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import validateRequest from '../../middlewares/validateRequest';
import { Role } from '../../generated/prisma/enums';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionValidations } from './subscription.validation';

const router = express.Router();

// Webhook endpoint (public with rawBody verification)
router.post('/webhook', SubscriptionController.handleWebhook);

// Plan & destination account discovery
router.get('/plans', SubscriptionController.getActivePlans);
router.get(
  '/payment-accounts',
  checkAuth(Role.BUSINESS_OWNER, Role.SUPER_ADMIN),
  SubscriptionController.getSuperAdminPaymentAccounts
);

// Subscription status & history (available even when expired so owner can renew)
router.get(
  '/status',
  checkAuth(Role.BUSINESS_OWNER, Role.STAFF),
  SubscriptionController.getSubscriptionStatus
);

router.get(
  '/me',
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(SubscriptionValidations.getMySubscriptionValidation),
  SubscriptionController.getMySubscription
);

router.get(
  '/payments',
  checkAuth(Role.BUSINESS_OWNER),
  SubscriptionController.getPaymentHistory
);

// Payment submission & renewal
router.post(
  '/pay',
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(SubscriptionValidations.submitPaymentValidation),
  SubscriptionController.submitPayment
);

router.post(
  '/renew',
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(SubscriptionValidations.submitPaymentValidation),
  SubscriptionController.renewSubscription
);

export const subscriptionRoutes = router;
