import { z } from 'zod';
import {
  PaymentGateway,
  PaymentPurpose,
  PaymentStatus,
} from '../../../generated/prisma/enums';

const getTransactionsQueryValidation = z.object({
  query: z
    .object({
      search: z.string().optional(),
      searchTerm: z.string().optional(),
      status: z
        .nativeEnum(PaymentStatus, {
          message: 'Status must be one of: PENDING, SUCCESS, FAILED, REFUNDED',
        })
        .optional(),
      gateway: z
        .nativeEnum(PaymentGateway, {
          message: 'Gateway must be one of: BKASH, ROCKET, NAGAD, STRIPE',
        })
        .optional(),
      purpose: z
        .nativeEnum(PaymentPurpose, {
          message: 'Purpose must be one of: MEMBERSHIP, PLATFORM_SUBSCRIPTION',
        })
        .optional(),
      businessId: z.string().optional(),
      payerUserId: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .optional(),
});

export const PaymentGatewayOversightValidation = {
  getTransactionsQueryValidation,
};
