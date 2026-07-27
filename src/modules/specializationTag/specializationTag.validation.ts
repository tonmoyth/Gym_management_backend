import { z } from "zod";

const createSpecializationTagSchema = z.object({
    body: z.object({
        name: z
            .string({
                message: "Name is required",
            })
            .trim()
            .min(2, "Name must be at least 2 characters")
            .max(60, "Name must be at most 60 characters"),
    }).strict(),
});

export const SpecializationTagValidations = {
    createSpecializationTagSchema,
};
