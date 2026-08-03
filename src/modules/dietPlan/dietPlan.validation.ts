import { z } from 'zod';

const createDietPlanValidation = z.object({
  body: z.object({
    memberId: z.string({ message: "Member ID is required" }),
    businessId: z.string().uuid("Invalid business UUID"),
    title: z.string().trim().min(1, "Title is required").max(150, "Title cannot exceed 150 characters"),
    goal: z.string().max(500, "Goal cannot exceed 500 characters").optional(),
    dailyCalories: z.number().int().positive("Daily calories must be positive"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional(),
    meals: z.array(
      z.object({
        mealType: z.string(),
        time: z.string(),
        foods: z.array(
          z.object({
            name: z.string(),
            quantity: z.string(),
          }).strict()
        ).min(1, "At least one food item is required"),
      }).strict()
    ).min(1, "At least one meal is required").max(10, "Cannot exceed 10 meals"),
  }).strict()
    .refine((data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    }, {
      message: "End date must be greater than start date",
      path: ["endDate"],
    }),
});

const getDietPlanValidation = z.object({
  params: z.object({
    memberId: z.string({ message: "Member ID is required" }),
  }).strict(),
});

const updateDietPlanValidation = z.object({
  params: z.object({
    id: z.string().uuid("Invalid diet plan UUID"),
  }).strict(),
  body: z.object({
    title: z.string().trim().min(1, "Title is required").max(150, "Title cannot exceed 150 characters").optional(),
    goal: z.string().max(500, "Goal cannot exceed 500 characters").optional(),
    dailyCalories: z.number().int().positive("Daily calories must be positive").optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional(),
    meals: z.array(
      z.object({
        mealType: z.string(),
        time: z.string(),
        foods: z.array(
          z.object({
            name: z.string(),
            quantity: z.string(),
          }).strict()
        ).min(1, "At least one food item is required"),
      }).strict()
    ).min(1, "At least one meal is required").max(10, "Cannot exceed 10 meals").optional(),
  }).strict()
    .refine((data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    }, {
      message: "End date must be greater than start date",
      path: ["endDate"],
    }),
});

export const DietPlanValidations = {
  createDietPlanValidation,
  updateDietPlanValidation,
  getDietPlanValidation,
};
