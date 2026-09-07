import { z } from "zod";

const createReviewValidation = z.object({
  body: z.object({
    businessId: z.string().uuid("Invalid Business ID UUID"),
    trainerId: z.string().uuid("Invalid Trainer ID UUID").optional(),
    rating: z.number().int("Rating must be an integer").min(1, "Rating must be at least 1").max(5, "Rating must not exceed 5"),
    comment: z.string().max(500, "Comment must not exceed 500 characters").optional(),
  }).strict(),
});

const getBusinessReviewsValidation = z.object({
  params: z.object({
    businessId: z.string().uuid("Invalid businessId UUID"),
  }).strict(),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    searchTerm: z.string().optional(),
    rating: z.string().optional(),
  }).passthrough(),
});

const getTrainerReviewsValidation = z.object({
  params: z.object({
    trainerId: z.string().uuid("Invalid trainerId UUID"),
  }).strict(),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    searchTerm: z.string().optional(),
    rating: z.string().optional(),
  }).passthrough(),
});

export const ReviewValidations = {
  getTrainerReviewsValidation,
  createReviewValidation,
  getBusinessReviewsValidation,
};
