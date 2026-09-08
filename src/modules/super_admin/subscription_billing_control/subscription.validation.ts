import { z } from 'zod';
import { SubscriptionStatus } from '../../../generated/prisma/enums';

const getSubscriptionsQueryValidation = z.object({
  query: z
    .object({
      search: z.string().optional(),
      searchTerm: z.string().optional(),
      status: z
        .nativeEnum(SubscriptionStatus, {
          message: 'Status must be one of: ACTIVE, INACTIVE, OVERDUE',
        })
        .optional(),
      businessId: z.string().optional(),
      page: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .optional(),
});

const updateSubscriptionStatusValidation = z.object({
  params: z.object({
    businessId: z
      .string({ message: 'Business ID is required' })
      .trim()
      .min(1, 'Business ID cannot be empty'),
  }),
  body: z
    .object({
      status: z.nativeEnum(SubscriptionStatus, {
        message: 'Status must be one of: ACTIVE, INACTIVE, OVERDUE',
      }),
    })
    .strict(),
});

export const SubscriptionBillingControlValidation = {
  getSubscriptionsQueryValidation,
  updateSubscriptionStatusValidation,
};
