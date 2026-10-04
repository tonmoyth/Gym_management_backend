import { z } from 'zod';

const createStaffValidation = z.object({
    body: z.object({
        name: z.string().optional(),
        fullName: z.string().optional(),
        email: z.string({ message: 'Email is required' }).email({ message: 'Invalid email address' }),
        password: z.string().min(6, { message: 'Password must be at least 6 characters' }).optional(),
        role: z.enum(['ADMIN', 'STAFF'], { message: 'Role must be either ADMIN or STAFF' }).optional(),
        permissionScope: z.string().optional(),
        permissions: z.array(z.string()).optional()
    }).refine((data) => Boolean(data.name?.trim() || data.fullName?.trim()), {
        message: 'Name is required',
        path: ['name']
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
