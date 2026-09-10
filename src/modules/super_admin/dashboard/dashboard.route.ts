import express from 'express';
import { dashboardController } from './dashboard.controller';
import { checkAuth } from '../../../middlewares/checkAuth';
import { checkPermission } from '../../../middlewares/checkPermission';
import { Role } from '../../../generated/prisma/enums';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF),
  checkPermission('DASHBOARD_READ'),
  dashboardController.getDashboardData
);

export const dashboardRoutes = router;
