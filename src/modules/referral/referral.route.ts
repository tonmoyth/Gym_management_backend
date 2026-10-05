import express from "express";

const router = express.Router();

// Referral system temporarily disabled - will be implemented later
/*
// Get the authenticated member's referral code
router.get(
  "/my-code",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  ReferralController.getMyReferralCode
);

// List Type-B referrals for the authenticated business owner
router.get(
  "/member",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(ReferralValidations.getOwnerMemberReferralsValidation),
  ReferralController.getOwnerMemberReferrals
);

// Credit a Type-B referral by the authenticated business owner
router.patch(
  "/member/:id/credit",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(ReferralValidations.creditMemberReferralValidation),
  ReferralController.creditMemberReferral
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

// Register a Type-A business referral (PUBLIC)
router.post(
  "/business",
  validateRequest(ReferralValidations.registerBusinessReferralValidation),
  ReferralController.registerBusinessReferral
);

// Validate a business referral code (PUBLIC)
router.get(
  "/business/validate/:code",
  ReferralController.validateBusinessReferralCode
);

// Get the authenticated business owner's referral code
router.get(
  "/business/my-code",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  ReferralController.getMyBusinessReferralCode
);

// Get referrals made by the authenticated business owner
router.get(
  "/business/me",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  ReferralController.getMyBusinessReferrals
);
*/

export const referralRoutes = router;
