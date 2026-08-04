import { z } from "zod";

const getRevenueReportValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required" }),
  }),
  query: z.object({
    period: z.enum(["month", "quarter", "year"]).optional(),
    year: z.string().optional(),
    month: z.string().optional(),
    quarter: z.string().optional(),
  }),
});

const getPayoutReportValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required" }),
  }),
  query: z.object({
    status: z.enum(["PENDING", "PAID"]).optional(),
    trainerId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const ReportValidations = {
  getRevenueReportValidation,
  getPayoutReportValidation,
};
