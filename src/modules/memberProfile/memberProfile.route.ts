import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import validateRequest from "../../middlewares/validateRequest";
import { memberProfileValidation } from "./memberProfile.validation";
import { memberProfileController } from "./memberProfile.controller";

const router = express.Router();

router.post(
  "/onboarding",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  validateRequest(memberProfileValidation.setFitnessGoalSchema),
  memberProfileController.setFitnessGoal
);

router.get(
  "/me",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  memberProfileController.getProfile
);

router.get(
  "/recommendations",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  memberProfileController.getRecommendations
);

router.get(
  "/me/dashboard",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  memberProfileController.getDashboard
);

export const memberProfileRoutes = router;
