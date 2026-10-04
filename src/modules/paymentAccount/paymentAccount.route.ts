import express from 'express';
import { checkAuth } from '../../middlewares/checkAuth';
import validateRequest from '../../middlewares/validateRequest';
import { Role } from '../../generated/prisma/enums';
import { PaymentAccountController } from './paymentAccount.controller';
import { PaymentAccountValidation } from './paymentAccount.validation';

const router = express.Router();

router.post(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.BUSINESS_OWNER, Role.TRAINER),
  validateRequest(PaymentAccountValidation.createPaymentAccountValidation),
  PaymentAccountController.createPaymentAccount
);

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.BUSINESS_OWNER, Role.TRAINER),
  PaymentAccountController.getPaymentAccounts
);

router.get(
  '/business/:businessId',
  PaymentAccountController.getBusinessPaymentAccounts
);

router.get(
  '/plan/:planId',
  PaymentAccountController.getPlanPaymentAccounts
);

router.get(
  '/:id',
  checkAuth(Role.SUPER_ADMIN, Role.BUSINESS_OWNER, Role.TRAINER),
  PaymentAccountController.getPaymentAccountById
);

router.patch(
  '/:id',
  checkAuth(Role.SUPER_ADMIN, Role.BUSINESS_OWNER, Role.TRAINER),
  validateRequest(PaymentAccountValidation.updatePaymentAccountValidation),
  PaymentAccountController.updatePaymentAccount
);

router.delete(
  '/:id',
  checkAuth(Role.SUPER_ADMIN, Role.BUSINESS_OWNER, Role.TRAINER),
  PaymentAccountController.deletePaymentAccount
);

export const paymentAccountRoutes = router;
