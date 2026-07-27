import { z } from 'zod';
import { Gender } from '../../generated/prisma/client';

const createTrainerProfileValidation = z.object({
  body: z.object({
    bio: z.string().max(2000, "Bio cannot exceed 2000 characters").optional(),
    gender: z.nativeEnum(Gender).optional(),
    specializationIds: z.array(z.string().uuid("Invalid specialization tag UUID")).optional(),
    certifications: z.array(
      z.object({
        title: z.string().min(1, "Title is required"),
        fileUrl: z.string().url("Must be a valid URL").optional().nullable(),
        issuer: z.string().min(1, "Issuer is required"),
        issueDate: z.string().datetime().or(z.date()),
        expiryDate: z.string().datetime().or(z.date()).optional().nullable(),
        credentialId: z.string().optional().nullable(),
        credentialUrl: z.string().url().optional().nullable(),
      }).strict()
    ).optional(),
  }).strict()
});

const updateTrainerProfileValidation = z.object({
  body: z.object({
    bio: z.string().max(2000, "Bio cannot exceed 2000 characters").optional(),
    gender: z.nativeEnum(Gender).optional(),
    specializationIds: z.array(z.string().uuid("Invalid specialization tag UUID")).optional(),
    certifications: z.array(
      z.object({
        title: z.string().min(1, "Title is required"),
        fileUrl: z.string().url("Must be a valid URL").optional().nullable(),
        issuer: z.string().min(1, "Issuer is required"),
        issueDate: z.string().datetime().or(z.date()),
        expiryDate: z.string().datetime().or(z.date()).optional().nullable(),
        credentialId: z.string().optional().nullable(),
        credentialUrl: z.string().url().optional().nullable(),
      }).strict()
    ).optional(),
  }).strict()
});

const getPublicTrainerProfileValidation = z.object({
  params: z.object({
    id: z.string().uuid("Invalid trainer profile ID"),
  }),
});

export const TrainerProfileValidations = {
  createTrainerProfileValidation,
  updateTrainerProfileValidation,
  getPublicTrainerProfileValidation,
};
