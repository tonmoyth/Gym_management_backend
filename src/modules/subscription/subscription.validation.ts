import { z } from 'zod';

const getMySubscriptionValidation = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const submitPaymentSchema = z.object({
  subscriptionPlanId: z.string().min(1, 'Subscription plan ID is required'),
  paymentAccountId: z
    .string()
    .min(1, 'Super Admin receiving payment account ID is required'),
  paymentMethod: z.enum(['BANK', 'BKASH', 'NAGAD'] as const, {
    message: 'Payment method is required (BANK, BKASH, NAGAD)',
  }),
  transactionId: z
    .string()
    .min(3, 'Transaction ID must be at least 3 characters'),
  paymentProof: z.string().optional(),
});

export const SubscriptionValidations = {
  getMySubscriptionValidation,
  submitPaymentValidation: z.object({
    body: submitPaymentSchema,
  }),
};
