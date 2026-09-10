export const auditLogSearchableFields = [
  'action',
  'resource',
  'details',
  'actor.fullName',
  'actor.email',
];

export const auditLogFilterableFields = [
  'action',
  'resource',
  'actorId',
  'businessId',
];

export const AUDIT_ACTIONS = [
  'USER_STATUS_UPDATED',
  'USER_CREATED',
  'USER_DELETED',
  'BUSINESS_APPROVED',
  'BUSINESS_REJECTED',
  'BUSINESS_SUSPENDED',
  'CERTIFICATION_VERIFIED',
  'CERTIFICATION_REJECTED',
  'DISPUTE_RESOLVED',
  'REVIEW_REMOVED',
  'JOB_POST_REMOVED',
  'SUBSCRIPTION_STATUS_UPDATED',
  'STAFF_CREATED',
  'STAFF_PERMISSION_UPDATED',
  'STAFF_REMOVED',
] as const;

export const AUDIT_RESOURCES = [
  'USER',
  'BUSINESS',
  'CERTIFICATION',
  'PAYMENT',
  'DISPUTE',
  'REVIEW',
  'JOB_POST',
  'SUBSCRIPTION',
  'STAFF',
] as const;
