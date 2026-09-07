import { z } from 'zod';
import { DisputeCategory } from '../../generated/prisma/enums';

const createDisputeSchema = z.object({
  body: z.object({
    subject: z.string({
      message: 'Subject is required',
    }).min(1, 'Subject cannot be empty'),
    description: z.string({
      message: 'Description is required',
    }).min(1, 'Description cannot be empty'),
    category: z.nativeEnum(DisputeCategory, {
      message: 'Category is required',
    }).optional().default(DisputeCategory.OTHER),
    businessId: z.string().uuid('Invalid business ID').optional(),
  }),
});

export const DisputeValidation = {
  createDisputeSchema,
};
