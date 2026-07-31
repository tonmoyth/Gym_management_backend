import { z } from 'zod';
import { Gender } from '../../generated/prisma/client';

const createTrainerProfileValidation = z.object({
  body: z.object({
    bio: z.string().max(2000, "Bio cannot exceed 2000 characters").optional(),
    gender: z.nativeEnum(Gender).optional(),
    experience: z.coerce.number().int().min(0, "Experience cannot be negative"),
    specializationIds: z.array(z.string().uuid("Invalid specialization tag UUID")).optional(),
    certifications: z.array(
      z.object({
        title: z.string().min(1, "Title is required"),
        fileUrl: z.string().url("Must be a valid URL").optional().nullable(),
        issuer: z.string().min(1, "Issuer is required"),
        issueDate: z.coerce.date(),
        expiryDate: z.coerce.date().optional().nullable(),
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
    experience: z.coerce.number().int().min(0, "Experience cannot be negative").optional(),
    specializationIds: z.array(z.string().uuid("Invalid specialization tag UUID")).optional(),
    certifications: z.array(
      z.object({
        title: z.string().min(1, "Title is required"),
        fileUrl: z.string().url("Must be a valid URL").optional().nullable(),
        issuer: z.string().min(1, "Issuer is required"),
        issueDate: z.coerce.date(),
        expiryDate: z.coerce.date().optional().nullable(),
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

const setSpecializationsValidation = z.object({
  body: z.object({
    specializationIds: z
      .array(z.string().uuid("Invalid specialization tag UUID"))
      .min(1, "At least one specialization is required")
      .max(10, "Cannot have more than 10 specializations"),
  }).strict(),
});


const uploadCertificationValidation = z.object({
  body: z.object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(120, "Title cannot exceed 120 characters"),
    issuer: z.string().trim().min(1, "Issuer is required").max(120, "Issuer cannot exceed 120 characters"),
    issueDate: z.coerce.date(),
    expiryDate: z.coerce.date().optional().nullable(),
    credentialId: z.string().max(100, "Credential ID cannot exceed 100 characters").optional().nullable(),
    credentialUrl: z.string().url("Must be a valid URL").optional().nullable(),
  }).strict()
    .refine((data) => {
      if (data.expiryDate && data.issueDate) {
        return new Date(data.expiryDate) > new Date(data.issueDate);
      }
      return true;
    }, {
      message: "Expiry date must be greater than issue date",
      path: ["expiryDate"],
    }),
});

const getBusinessTrainerDashboardValidation = z.object({
  params: z.object({
    businessId: z.string().uuid("Invalid business UUID"),
  }),
});

export const TrainerProfileValidations = {
  createTrainerProfileValidation,
  updateTrainerProfileValidation,
  getPublicTrainerProfileValidation,
  setSpecializationsValidation,
  uploadCertificationValidation,
  getBusinessTrainerDashboardValidation,
};

