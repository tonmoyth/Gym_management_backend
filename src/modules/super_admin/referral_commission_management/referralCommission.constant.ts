export const DEFAULT_BUSINESS_REFERRAL_COMMISSION = Number(process.env.DEFAULT_BUSINESS_REFERRAL_COMMISSION) || 500.00;

export const businessReferralSearchableFields = [
  'referralCode',
  'referrerOwner.fullName',
  'referrerOwner.email',
  'referredBusiness.name',
  'referredBusiness.email',
  'payoutReference'
];

export const businessReferralFilterableFields = [
  'status',
  'referrerOwnerId',
  'referredBusinessId',
  'creditedById'
];
