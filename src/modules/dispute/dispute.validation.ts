import { z } from 'zod';
import { DisputeCategory } from '../../generated/prisma/enums';

const createDisputeSchema = z.object({
  body: z.object({
    subject: z.string({
      message: 'Subject is required',
    }),
    description: z.string({
      message: 'Description is required',
    }),
    category: z.nativeEnum(DisputeCategory, {
      message: 'Category is required',
    }),
    businessId: z.string().uuid('Invalid business ID').optional(),
  }),
});

export const DisputeValidation = {
  createDisputeSchema,
};
