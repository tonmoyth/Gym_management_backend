import { z } from 'zod';
import { ReferralStatus } from '../../../generated/prisma/enums';

const getBusinessReferralsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    searchTerm: z.string().optional(),
    search: z.string().optional(),
    status: z.nativeEnum(ReferralStatus).optional(),
    referrerOwnerId: z.string().uuid('Invalid referrerOwnerId format').optional(),
    referredBusinessId: z.string().uuid('Invalid referredBusinessId format').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

const creditCommissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid referral ID format'),
  }),
  body: z.object({
    commissionAmount: z.number().positive('Commission amount must be greater than 0').optional(),
    payoutReference: z.string().trim().max(100, 'Payout reference cannot exceed 100 characters').optional(),
    notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
  }),
});

const getReferralByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid referral ID format'),
  }),
});

export const ReferralCommissionValidation = {
  getBusinessReferralsQuerySchema,
  creditCommissionSchema,
  getReferralByIdSchema,
};
