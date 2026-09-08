import { z } from 'zod';

const updateAccountStatusZodSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED']),
  }),
});

const getUsersQueryZodSchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      searchTerm: z.string().optional(),
      role: z.enum(['MEMBER', 'TRAINER']).optional(),
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
