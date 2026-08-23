import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLE } from "../Business/business.constant";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionValidations } from "./subscription.validation";

const router = express.Router();

router.get(
  "/me",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(SubscriptionValidations.getMySubscriptionValidation),
  SubscriptionController.getMySubscription
);

export const subscriptionRoutes = router;
