import express from 'express';
import { Role } from '../../../generated/prisma/enums';
import { checkAuth } from '../../../middlewares/checkAuth';
import validateRequest from '../../../middlewares/validateRequest';
import { ReportsValidation } from './reports.validation';
import { ReportsController } from './reports.controller';

const router = express.Router();

router.get(
  '/platform',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(ReportsValidation.getPlatformReportValidation),
  ReportsController.getPlatformReport
);

router.get(
  '/export',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(ReportsValidation.exportPlatformReportValidation),
  ReportsController.exportPlatformReport
);

export const platformReportsRoutes = router;
