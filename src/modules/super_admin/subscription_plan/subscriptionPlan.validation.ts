import { z } from 'zod';

const createSubscriptionPlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be 0 or greater'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY'] as const, {
    message: 'Billing cycle is required (MONTHLY, YEARLY)',
  }),
  durationDays: z.number().int().positive().optional(),
  features: z
    .array(z.string().min(1, 'Feature name cannot be empty'))
    .min(1, 'At least one feature is required'),
  status: z.enum(['ACTIVE', 'INACTIVE'] as const).optional(),
});

const updateSubscriptionPlanSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY'] as const).optional(),
  durationDays: z.number().int().positive().optional(),
  features: z
    .array(z.string().min(1, 'Feature name cannot be empty'))
    .min(1)
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE'] as const).optional(),
});

export const SubscriptionPlanValidation = {
  createSubscriptionPlanValidation: z.object({
    body: createSubscriptionPlanSchema,
  }),
  updateSubscriptionPlanValidation: z.object({
    body: updateSubscriptionPlanSchema,
  }),
};
