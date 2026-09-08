import { z } from 'zod';
import { BusinessStatus } from '../../../generated/prisma/enums';

const updateBusinessStatusZodSchema = z.object({
  body: z.object({
    status: z.enum([
      BusinessStatus.PENDING_APPROVAL,
      BusinessStatus.ACTIVE,
      BusinessStatus.SUSPENDED,
      BusinessStatus.REJECTED,
    ]).optional(),
  }),
});

const rejectBusinessZodSchema = z.object({
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const BusinessManagementValidation = {
  updateBusinessStatusZodSchema,
  rejectBusinessZodSchema,
};
