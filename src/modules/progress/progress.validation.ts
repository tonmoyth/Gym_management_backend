import { z } from "zod";

const createProgressValidation = z.object({
  body: z.object({
    memberId: z.string({ message: "Member ID is required" }).uuid("Invalid memberId UUID"),
    weight: z.number().positive("Weight must be positive").optional(),
    bmi: z.number().positive("BMI must be positive").optional(),
    measurements: z.record(z.string(), z.any()).optional(),
    workoutLog: z.string().optional(),
    loggedAt: z.coerce.date().optional(),
  }).strict(),
});

const getProgressHistoryValidation = z.object({
  params: z.object({
    memberId: z.string().uuid("Invalid memberId UUID"),
  }).strict(),
  query: z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }).passthrough(),
});

export const ProgressValidations = {
  createProgressValidation,
  getProgressHistoryValidation,
};
