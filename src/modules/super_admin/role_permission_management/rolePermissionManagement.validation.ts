import { z } from 'zod';

const createStaffValidation = z.object({
    body: z.object({
        name: z.string({ message: 'Name is required' }).min(1, { message: 'Name cannot be empty' }),
        email: z.string({ message: 'Email is required' }).email({ message: 'Invalid email address' }),
        password: z.string({ message: 'Password is required' }).min(6, { message: 'Password must be at least 6 characters' }),
        role: z.enum(['ADMIN', 'STAFF'], { message: 'Role must be either ADMIN or STAFF' }),
        permissions: z.array(z.string(), { message: 'Permissions array is required' }).min(1, { message: 'At least one permission is required' })
    })
});

const updateStaffPermissionsValidation = z.object({
    params: z.object({
        id: z.string({ message: 'User ID is required' }).min(1, { message: 'User ID cannot be empty' })
    }),
    body: z.object({
        role: z.enum(['ADMIN', 'STAFF'], { message: 'Role must be either ADMIN or STAFF' }).optional(),
        permissions: z.array(z.string()).optional(),
        status: z.enum(['ACTIVE', 'SUSPENDED'], { message: 'Status must be ACTIVE or SUSPENDED' }).optional()
    })
});

const staffIdParamValidation = z.object({
    params: z.object({
        id: z.string({ message: 'User ID is required' }).min(1, { message: 'User ID cannot be empty' })
    })
});

export const RolePermissionValidations = {
    createStaffValidation,
    updateStaffPermissionsValidation,
    staffIdParamValidation
};
