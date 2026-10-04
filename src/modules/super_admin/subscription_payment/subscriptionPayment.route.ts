import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import validateRequest from '../../../middlewares/validateRequest';
import { Role } from '../../../generated/prisma/enums';
import { SubscriptionPaymentController } from './subscriptionPayment.controller';
import { SubscriptionPaymentValidation } from './subscriptionPayment.validation';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN),
  SubscriptionPaymentController.getAllSubscriptionPayments
);

router.get(
  '/:id',
  checkAuth(Role.SUPER_ADMIN),
  SubscriptionPaymentController.getSubscriptionPaymentById
);

router.patch(
  '/:id/approve',
  checkAuth(Role.SUPER_ADMIN),
  SubscriptionPaymentController.approvePayment
);

router.patch(
  '/:id/reject',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(SubscriptionPaymentValidation.rejectPaymentValidation),
  SubscriptionPaymentController.rejectPayment
);

export const adminSubscriptionPaymentRoutes = router;
