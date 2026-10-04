import { z } from 'zod';

const rejectPaymentSchema = z.object({
  rejectionReason: z
    .string()
    .min(3, 'Rejection reason must be at least 3 characters'),
});

export const SubscriptionPaymentValidation = {
  rejectPaymentValidation: z.object({
    body: rejectPaymentSchema,
  }),
};
