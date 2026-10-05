import express from "express";

const router = express.Router();

// Referral system temporarily disabled - will be implemented later
/*
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
*/

export const memberReferralSettingRoutes = router;
