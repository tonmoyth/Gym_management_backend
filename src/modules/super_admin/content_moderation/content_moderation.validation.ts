import { z } from 'zod';

const getReviewsQuerySchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      searchTerm: z.string().optional(),
      rating: z.union([z.string(), z.number()]).optional(),
      businessId: z.string().optional(),
      trainerId: z.string().optional(),
      memberId: z.string().optional(),
      isRemoved: z.union([z.string(), z.boolean()]).optional(),
      page: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .optional(),
});

const removeReviewSchema = z.object({
  params: z.object({
    id: z
      .string({
        message: 'Review ID is required',
      })
      .trim()
      .min(1, 'Review ID is required'),
  }),
});

const getJobPostsQuerySchema = z.object({
  query: z
    .object({
      search: z.string().optional(),
      searchTerm: z.string().optional(),
      isOpen: z.union([z.string(), z.boolean()]).optional(),
      businessId: z.string().optional(),
      specializationTagId: z.string().optional(),
      page: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .optional(),
});

const removeJobPostSchema = z.object({
  params: z.object({
    id: z
      .string({
        message: 'Job post ID is required',
      })
      .trim()
      .min(1, 'Job post ID is required'),
  }),
});

export const ContentModerationValidation = {
  getReviewsQuerySchema,
  removeReviewSchema,
  getJobPostsQuerySchema,
  removeJobPostSchema,
};
