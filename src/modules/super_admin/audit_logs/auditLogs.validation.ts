import { z } from 'zod';

const getAuditLogsQuerySchema = z.object({
  query: z.object({
    actorId: z.string().optional(),
    action: z.string().optional(),
    resource: z.string().optional(),
    businessId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    searchTerm: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const AuditLogsValidation = {
  getAuditLogsQuerySchema,
};
