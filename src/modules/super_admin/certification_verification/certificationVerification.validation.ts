import { z } from 'zod';

const getPendingCertificationsValidation = z.object({
  query: z
    .object({
      search: z.string().optional(),
      searchTerm: z.string().optional(),
      issuer: z.string().optional(),
      trainerId: z.string().optional(),
      page: z.union([z.string(), z.number()]).optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .optional(),
});

const certificationIdParamValidation = z.object({
  params: z.object({
    id: z.string({ message: 'Certification ID is required' }).min(1, 'Certification ID cannot be empty'),
  }),
});

const rejectCertificationValidation = z.object({
  params: z.object({
    id: z.string({ message: 'Certification ID is required' }).min(1, 'Certification ID cannot be empty'),
  }),
  body: z.object({
    reason: z
      .string({ message: 'Rejection reason is required' })
      .trim()
      .min(1, 'Rejection reason must not be empty'),
  }),
});

export const CertificationVerificationValidation = {
  getPendingCertificationsValidation,
  certificationIdParamValidation,
  rejectCertificationValidation,
};
