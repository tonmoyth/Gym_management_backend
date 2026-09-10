import express from 'express';
import { Role } from '../../../generated/prisma/enums';
import { checkAuth } from '../../../middlewares/checkAuth';
import validateRequest from '../../../middlewares/validateRequest';
import { AuditLogsValidation } from './auditLogs.validation';
import { AuditLogsController } from './auditLogs.controller';

const router = express.Router();

router.get(
  '/',
  checkAuth(Role.SUPER_ADMIN),
  validateRequest(AuditLogsValidation.getAuditLogsQuerySchema),
  AuditLogsController.getAuditLogs
);

export const auditLogsRoutes = router;
