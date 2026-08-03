import { z } from "zod";

const setFitnessGoalSchema = z.object({
  body: z.object({
    fitnessGoalTagId: z.string({
      message: "Fitness goal tag ID is required",
    }).uuid("Invalid UUID format"),
  }).strict(),
});

export const memberProfileValidation = {
  setFitnessGoalSchema,
};
