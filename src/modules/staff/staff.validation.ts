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

export const StaffValidations = {
    addStaffValidation
};
