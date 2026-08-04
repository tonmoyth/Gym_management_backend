import { z } from "zod";

const createOrUpdatePayoutValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }),
  }),
  body: z.object({
    trainerId: z.string({ message: "Trainer ID is required." }),
    year: z.number().int().min(2000, "Invalid year."),
    month: z.number().int().min(1).max(12, "Month must be between 1 and 12."),
    amount: z.number().min(0.01, "Amount must be greater than 0."),
    note: z.string().optional(),
  }),
});

const getPayoutsValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }),
  }),
  query: z.object({
    month: z.string().optional(),
    year: z.string().optional(),
    status: z.enum(["PENDING", "PAID"]).optional(),
    trainerId: z.string().optional(),
    searchTerm: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

const markPaidValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }),
    id: z.string({ message: "Payout ID is required." }),
  }),
  body: z.object({
    transactionReference: z.string().optional(),
  }),
});

export const TrainerPayoutValidations = {
  createOrUpdatePayoutValidation,
  getPayoutsValidation,
  markPaidValidation,
};
