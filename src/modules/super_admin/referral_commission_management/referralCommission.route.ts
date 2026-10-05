import express from 'express';

const router = express.Router();

// Referral system temporarily disabled - will be implemented later
/*
// All routes in this module are strictly restricted to SUPER_ADMIN
router.use(checkAuth(Role.SUPER_ADMIN));

// Get all Type-A business referrals across the platform
router.get(
  '/business',
  validateRequest(ReferralCommissionValidation.getBusinessReferralsQuerySchema),
  ReferralCommissionController.getAllBusinessReferrals
);

// Get platform-wide business referral summary metrics
router.get(
  '/business/stats/summary',
  ReferralCommissionController.getReferralSummaryStats
);

// Get a single business referral by ID
router.get(
  '/business/:id',
  validateRequest(ReferralCommissionValidation.getReferralByIdSchema),
  ReferralCommissionController.getBusinessReferralById
);

// Credit platform commission to the referring Business Owner
router.patch(
  '/business/:id/credit',
  validateRequest(ReferralCommissionValidation.creditCommissionSchema),
  ReferralCommissionController.creditCommission
);
*/

export const referralCommissionRoutes = router;
