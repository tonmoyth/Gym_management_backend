import express from 'express';
import { checkAuth } from '../../../middlewares/checkAuth';
import { Role } from '../../../generated/prisma/enums';
import validateRequest from '../../../middlewares/validateRequest';
import { PaymentGatewayOversightValidation } from './payment.validation';
import { PaymentGatewayOversightController } from './payment.controller';

const router = express.Router();

router.get(
  '/gateways/status',
  checkAuth(Role.SUPER_ADMIN),
  PaymentGatewayOversightController.getGatewayStatus
);

router.get(
  '/transactions',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(
    PaymentGatewayOversightValidation.getTransactionsQueryValidation
  ),
  PaymentGatewayOversightController.getAllTransactions
);

export const paymentGatewayOversightRoutes = router;
