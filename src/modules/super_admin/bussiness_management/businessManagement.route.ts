import express from 'express';
import { BusinessManagementController } from './businessManagement.controller';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import { Role } from '../../../generated/prisma/enums';

import { BusinessManagementValidation } from './businessManagement.validation';
import validateRequest from '../../../middlewares/validateRequest';

const router = express.Router();

router.get(
  '/pending',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('BUSINESS_READ'),
  BusinessManagementController.getPendingBusinesses
);

router.patch(
  '/:id/approve',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('BUSINESS_APPROVE'),
  validateRequest(BusinessManagementValidation.updateBusinessStatusZodSchema),
  BusinessManagementController.approveBusiness
);

router.patch(
  '/:id/reject',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  checkPermission('BUSINESS_SUSPEND'),
  validateRequest(BusinessManagementValidation.rejectBusinessZodSchema),
  BusinessManagementController.rejectBusiness
);

router.patch(
  '/:id/suspend',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  checkPermission('BUSINESS_SUSPEND'),
  validateRequest(BusinessManagementValidation.updateBusinessStatusZodSchema),
  BusinessManagementController.suspendBusiness
);

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('BUSINESS_READ'),
  BusinessManagementController.getAllBusinesses
);

export const businessManagementRoutes = router;
