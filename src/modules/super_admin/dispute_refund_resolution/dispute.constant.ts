export const disputeSearchableFields = ['subject', 'description'];

export const disputeFilterableFields = [
  'status',
  'category',
  'userId',
  'businessId',
  'trainerId',
];

export const DISPUTE_RESOLUTION_TYPE = {
  REFUND: 'REFUND',
  WARNING: 'WARNING',
  ACCOUNT_ACTION: 'ACCOUNT_ACTION',
  DISMISSAL: 'DISMISSAL',
} as const;

export type DisputeResolutionType =
  (typeof DISPUTE_RESOLUTION_TYPE)[keyof typeof DISPUTE_RESOLUTION_TYPE];
