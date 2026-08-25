import express from "express";

import validateRequest from "../../middlewares/validateRequest";

import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import { PayoutValidation } from "./payout.validation";
import { PayoutController } from "./payout.controller";

const router = express.Router();

router.get(
  "/trainer/me",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  validateRequest(PayoutValidation.getMyTrainerPayoutsSchema),
  PayoutController.getMyTrainerPayouts
);

export const payoutRoutes = router;
