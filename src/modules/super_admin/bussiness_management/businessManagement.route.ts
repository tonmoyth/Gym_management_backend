import express from 'express';
import { BusinessManagementController } from './businessManagement.controller';
import { checkAuth } from '../../../middlewares/checkAuth';
import { Role } from '../../../generated/prisma/enums';

import { BusinessManagementValidation } from './businessManagement.validation';
import validateRequest from '../../../middlewares/validateRequest';

const router = express.Router();

router.get(
  '/pending',
  checkAuth(Role.SUPER_ADMIN),
  BusinessManagementController.getPendingBusinesses
);

router.patch(
  '/:id/approve',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(BusinessManagementValidation.updateBusinessStatusZodSchema),
  BusinessManagementController.approveBusiness
);

router.patch(
  '/:id/reject',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(BusinessManagementValidation.rejectBusinessZodSchema),
  BusinessManagementController.rejectBusiness
);

router.patch(
  '/:id/suspend',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(BusinessManagementValidation.updateBusinessStatusZodSchema),
  BusinessManagementController.suspendBusiness
);

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN),
  BusinessManagementController.getAllBusinesses
);

export const businessManagementRoutes = router;
