import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import validateRequest from "../../middlewares/validateRequest";
import { ReferralValidations } from "./referral.validation";
import { ReferralController } from "./referral.controller";


const router = express.Router();

// Get the authenticated member's referral code
router.get(
  "/my-code",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  ReferralController.getMyReferralCode
);

// Register a Type-B referral
router.post(
  "/member",
  validateRequest(ReferralValidations.registerReferralValidation),
  ReferralController.registerReferral
);

// Get referrals made by the authenticated member
router.get(
  "/member/me",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  ReferralController.getMyReferrals
);

export const referralRoutes = router;
