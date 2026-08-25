import { z } from "zod";

const getMyTrainerPayoutsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    month: z.string().optional(), // Expected format like "YYYY-MM"
    year: z.string().optional(),
    status: z.enum(["PENDING", "PAID"]).optional(),
    businessId: z.string().uuid().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }).optional(),
});

export const PayoutValidation = {
  getMyTrainerPayoutsSchema,
};
