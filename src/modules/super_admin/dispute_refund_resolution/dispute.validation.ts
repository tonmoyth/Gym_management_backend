import { z } from 'zod';
import { DisputeCategory } from '../../../generated/prisma/enums';

const getDisputesQuerySchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      searchTerm: z.string().optional(),
      status: z.string().optional(),
      category: z.nativeEnum(DisputeCategory).optional(),
      userId: z.string().optional(),
      businessId: z.string().optional(),
      trainerId: z.string().optional(),
      page: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .optional(),
});

const getDisputeByIdSchema = z.object({
  params: z.object({
    id: z
      .string({
        message: 'Dispute ID is required',
      })
      .trim()
      .min(1, 'Dispute ID is required'),
  }),
});

const resolveDisputeSchema = z.object({
  params: z.object({
    id: z
      .string({
        message: 'Dispute ID is required',
      })
      .trim()
      .min(1, 'Dispute ID is required'),
  }),
  body: z
    .object({
      resolution: z
        .enum(['REFUND', 'WARNING', 'ACCOUNT_ACTION', 'DISMISSAL'] as const)
        .optional(),
      status: z.enum(['RESOLVED', 'DISMISSED'] as const).optional(),
      reason: z.string().optional(),
      resolutionNote: z.string().optional(),
      paymentId: z.string().optional(),
      accountAction: z.enum(['SUSPEND', 'ACTIVATE'] as const).optional(),
      targetUserId: z.string().optional(),
      refundAmount: z.union([z.number(), z.string()]).optional(),
    })
    .refine(
      (data) => Boolean(data.reason?.trim() || data.resolutionNote?.trim()),
      {
        message: 'Resolution reason is required',
        path: ['reason'],
      }
    )
    .refine(
      (data) => Boolean(data.resolution || data.status),
      {
        message:
          'Resolution must be one of: REFUND, WARNING, ACCOUNT_ACTION, DISMISSAL',
        path: ['resolution'],
      }
    ),
});

export const DisputeRefundResolutionValidation = {
  getDisputesQuerySchema,
  getDisputeByIdSchema,
  resolveDisputeSchema,
};
