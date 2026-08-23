import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLE } from "../Business/business.constant";
import { MemberReferralSettingController } from "./memberReferralSetting.controller";
import { MemberReferralSettingValidations } from "./memberReferralSetting.validation";

const router = express.Router();

router.put(
  "/:businessId/referral-settings",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(MemberReferralSettingValidations.setReferralSettingsValidation),
  MemberReferralSettingController.setReferralSettings
);

router.get(
  "/:businessId/referral-settings",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(MemberReferralSettingValidations.getReferralSettingsValidation),
  MemberReferralSettingController.getReferralSettings
);

export const memberReferralSettingRoutes = router;
