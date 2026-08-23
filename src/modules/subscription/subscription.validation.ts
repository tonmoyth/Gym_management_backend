import { z } from "zod";

const getMySubscriptionValidation = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const SubscriptionValidations = {
  getMySubscriptionValidation,
};
