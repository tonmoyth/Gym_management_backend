import { z } from 'zod';

const createMembershipPlanValidation = z.object({
    params: z.object({
        businessId: z.string().uuid({ message: 'Invalid Business ID' })
    }),
    body: z.object({
        name: z.string({ message: 'Name is required' }).trim().min(1, 'Name cannot be empty').max(100, 'Name must be at most 100 characters'),
        description: z.string().trim().optional(),
        price: z.number({ message: 'Price is required' }).positive('Price must be a positive number'),
        durationDays: z.number({ message: 'Duration is required' }).int().min(1, 'Duration must be at least 1 day').max(3650, 'Duration cannot exceed 3650 days'),
        benefits: z.array(z.string().trim().min(1, 'Benefit cannot be empty')).min(1, 'At least one benefit is required')
    }).strict()
});

const getMembershipPlansValidation = z.object({
    params: z.object({
        businessId: z.string().uuid({ message: 'Invalid Business ID' })
    })
});

export const MembershipPlanValidations = {
    createMembershipPlanValidation,
    getMembershipPlansValidation
};
