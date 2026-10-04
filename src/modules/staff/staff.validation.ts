import { z } from 'zod';
import { StaffPermissionRole } from '../../generated/prisma/enums';

const roleMapping: Record<string, StaffPermissionRole> = {
    RECEPTIONIST: StaffPermissionRole.FRONT_DESK,
    FRONT_DESK: StaffPermissionRole.FRONT_DESK,
    MANAGER: StaffPermissionRole.FULL,
    FULL: StaffPermissionRole.FULL,
    TRAINER_COORDINATOR: StaffPermissionRole.TRAINER_MANAGER,
    TRAINER_MANAGER: StaffPermissionRole.TRAINER_MANAGER,
    MEMBER_MANAGER: StaffPermissionRole.MEMBER_MANAGER,
    FINANCE: StaffPermissionRole.FINANCE
};

const permissionRoleSchema = z.preprocess(
    (val) => (typeof val === 'string' && roleMapping[val] ? roleMapping[val] : val),
    z.nativeEnum(StaffPermissionRole, { error: 'Permission Role is required' })
);

const addStaffValidation = z.object({
    params: z.object({
        businessId: z.string().uuid({ message: 'Invalid Business ID' })
    }),
    body: z.object({
        userId: z.string().optional(),
        email: z.string().email({ message: 'Invalid email address' }).optional(),
        permissionRole: permissionRoleSchema
    }).refine((data) => Boolean(data.userId || data.email), {
        message: 'Staff email or User ID is required',
        path: ['email']
    })
});

const getStaffListValidation = z.object({
    params: z.object({
        businessId: z.string().uuid({ message: 'Invalid Business ID' })
    })
});

const updateStaffPermissionValidation = z.object({
    params: z.object({
        businessId: z.string().uuid({ message: 'Invalid Business ID' }),
        staffId: z.string().uuid({ message: 'Invalid Staff ID' })
    }),
    body: z.object({
        permissionRole: permissionRoleSchema,
        id: z.any().optional(),
        businessId: z.any().optional(),
        userId: z.any().optional(),
        createdAt: z.any().optional()
    }).strict()
});

const removeStaffValidation = z.object({
    params: z.object({
        businessId: z.string().uuid({ message: 'Invalid Business ID' }),
        staffId: z.string().uuid({ message: 'Invalid Staff ID' })
    })
});

export const StaffValidations = {
    addStaffValidation,
    getStaffListValidation,
    updateStaffPermissionValidation,
    removeStaffValidation
};
