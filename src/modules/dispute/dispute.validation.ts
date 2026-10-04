import { z } from 'zod';
import { DisputeCategory } from '../../generated/prisma/enums';

const normalizeDisputeCategory = (val: unknown): DisputeCategory => {
  if (typeof val === 'string') {
    const upper = val.toUpperCase();
    if (upper === 'PAYMENT' || upper === 'PAYOUT') return DisputeCategory.PAYOUT;
    if (upper === 'BILLING') return DisputeCategory.BILLING;
    if (upper === 'SERVICE' || upper === 'SERVICE_QUALITY') return DisputeCategory.SERVICE;
    if (upper === 'CONDUCT') return DisputeCategory.CONDUCT;
    if (Object.values(DisputeCategory).includes(upper as any)) return upper as DisputeCategory;
  }
  return DisputeCategory.OTHER;
};

const createDisputeSchema = z.object({
  body: z.object({
    subject: z.string({
      message: 'Subject is required',
    }).min(1, 'Subject cannot be empty'),
    description: z.string({
      message: 'Description is required',
    }).min(1, 'Description cannot be empty'),
    category: z.preprocess(
      (val) => normalizeDisputeCategory(val),
      z.nativeEnum(DisputeCategory)
    ).optional().default(DisputeCategory.OTHER),
    businessId: z.preprocess(
      (val) => {
        if (!val || typeof val !== 'string') return undefined;
        const trimmed = val.trim();
        if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return undefined;
        return trimmed;
      },
      z.string().uuid('Invalid business ID').optional()
    ),
  }),
});

const getSingleDisputeSchema = z.object({
  params: z.object({
    id: z.string({
      message: 'Dispute ID is required',
    }).uuid('Invalid dispute ID format'),
  }),
});

export const DisputeValidation = {
  createDisputeSchema,
  getSingleDisputeSchema,
};
