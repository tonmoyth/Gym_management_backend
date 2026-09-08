export const paymentSearchableFields = [
  'id',
  'gatewayTransactionId',
  'payer.fullName',
  'payer.email',
];

export const paymentFilterableFields = [
  'status',
  'gateway',
  'purpose',
  'currency',
  'payerUserId',
  'membershipId',
  'subscriptionId',
];

export const GATEWAY_CHECK_TIMEOUT_MS = 5000;
