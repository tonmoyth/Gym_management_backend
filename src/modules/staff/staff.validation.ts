import { z } from 'zod';
import { StaffPermissionRole } from '../../generated/prisma/enums';

const addStaffValidation = z.object({
    params: z.object({
        businessId: z.string().uuid({ message: 'Invalid Business ID' })
    }),
    body: z.object({
        userId: z.string({ message: 'User ID is required' }),
        permissionRole: z.nativeEnum(StaffPermissionRole, { error: 'Permission Role is required' })
    }).strict()
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
        permissionRole: z.nativeEnum(StaffPermissionRole, { error: 'Permission Role is required' }),
        id: z.any().optional(),
        businessId: z.any().optional(),
        userId: z.any().optional(),
        createdAt: z.any().optional()
    }).strict()
});

export const StaffValidations = {
    addStaffValidation,
    getStaffListValidation,
    updateStaffPermissionValidation
};
