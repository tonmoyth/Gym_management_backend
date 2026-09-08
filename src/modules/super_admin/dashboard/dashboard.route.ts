import express from 'express';
import { dashboardController } from './dashboard.controller';
import { checkAuth } from '../../../middlewares/checkAuth';
import { Role } from '../../../generated/prisma/enums';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN),
  dashboardController.getDashboardData
);

export const dashboardRoutes = router;
