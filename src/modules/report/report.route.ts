import { Router } from "express";

import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { Role } from "../../generated/prisma/client";
import { ReportValidations } from "./report.validation";
import { ReportController } from "./report.controller";


const router = Router();

router.get(
  "/businesses/:businessId/reports/revenue",
  // @ts-ignore
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(ReportValidations.getRevenueReportValidation),
  ReportController.getRevenueReport
);

router.get(
  "/businesses/:businessId/reports/payouts",
  // @ts-ignore
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(ReportValidations.getPayoutReportValidation),
  ReportController.getPayoutReport
);

export const reportRoutes = router;
