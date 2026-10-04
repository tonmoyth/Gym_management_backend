import { z } from 'zod';

const updateAccountStatusZodSchema = z.object({
  body: z
    .object({
      status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => data.status !== undefined || data.isActive !== undefined, {
      message: "Either 'status' or 'isActive' must be provided",
    }),
});

const getUsersQueryZodSchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      searchTerm: z.string().optional(),
      role: z
        .enum([
          'MEMBER',
          'TRAINER',
          'BUSINESS_OWNER',
          'STAFF',
          'ADMIN',
          'SUPER_ADMIN',
        ])
        .optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
      page: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .optional(),
});

export const TrainerMemberOversightValidation = {
  updateAccountStatusZodSchema,
  getUsersQueryZodSchema,
};
