import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLE } from "../Business/business.constant";
import { TrainerPayoutController } from "./trainerPayout.controller";
import { TrainerPayoutValidations } from "./trainerPayout.validation";

const router = express.Router();

router.post(
  "/:businessId/payouts",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(TrainerPayoutValidations.createOrUpdatePayoutValidation),
  TrainerPayoutController.createOrUpdatePayout
);

router.get(
  "/:businessId/payouts",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(TrainerPayoutValidations.getPayoutsValidation),
  TrainerPayoutController.getPayouts
);

router.patch(
  "/:businessId/payouts/:id/mark-paid",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(TrainerPayoutValidations.markPaidValidation),
  TrainerPayoutController.markPaid
);

export const trainerPayoutRoutes = router;
