import { z } from "zod";

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
};
