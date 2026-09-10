import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { PaymentGatewayOversightValidation } from './payment.validation';
import { PaymentGatewayOversightController } from './payment.controller';

const router = express.Router();

router.get(
  '/gateways/status',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('PAYMENT_READ'),
  PaymentGatewayOversightController.getGatewayStatus
);

router.get(
  '/transactions',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('PAYMENT_READ'),
  validateRequest(
    PaymentGatewayOversightValidation.getTransactionsQueryValidation
  ),
  PaymentGatewayOversightController.getAllTransactions
);

export const paymentGatewayOversightRoutes = router;
