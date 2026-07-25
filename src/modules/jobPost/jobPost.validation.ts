import { z } from 'zod';

const createJobPostValidation = z.object({
    body: z.object({
        title: z.string({ message: 'Title is required' })
            .trim()
            .min(5, 'Title must be at least 5 characters')
            .max(120, 'Title cannot exceed 120 characters')
            .transform((val) => val.replace(/\s+/g, ' ')), // Normalize extra spaces
        description: z.string({ message: 'Description is required' })
            .trim()
            .min(30, 'Description must be at least 30 characters')
            .max(3000, 'Description cannot exceed 3000 characters'),
        specializationTagId: z.string({ message: 'Specialization tag ID is required' })
            .uuid({ message: 'Specialization tag ID must be a valid UUID' }),
    }).strict(), // Reject unknown fields
});

const closeJobPostValidation = z.object({
    params: z.object({
        id: z.string({ message: 'Job post ID is required' })
            .uuid({ message: 'Job post ID must be a valid UUID' }),
    }),
});

const getJobPostApplicantsValidation = z.object({
    params: z.object({
        id: z.string({ message: 'Job post ID is required' })
            .uuid({ message: 'Job post ID must be a valid UUID' }),
    }),
});

const approveTrainerApplicationValidation = z.object({
    params: z.object({
        appId: z.string({ message: 'Application ID is required' })
            .uuid({ message: 'Application ID must be a valid UUID' }),
    }),
});

export const JobPostValidations = {
    createJobPostValidation,
    closeJobPostValidation,
    getJobPostApplicantsValidation,
    approveTrainerApplicationValidation,
};
