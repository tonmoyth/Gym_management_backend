import AppError from '../../errors/AppError';
import { prisma } from '../../lib/prisma';
import { StaffPermissionRole } from '../../generated/prisma/enums';

const addStaff = async (
    businessId: string,
    ownerId: string,
    payload: { userId: string; permissionRole: StaffPermissionRole }
) => {
    const { userId, permissionRole } = payload;

    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden: You do not own this business');
    }

    if (userId === ownerId) {
        throw new AppError(400, 'Business owner cannot be added as staff');
    }

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        throw new AppError(404, 'User not found');
    }

    const existingStaff = await prisma.businessStaff.findUnique({
        where: {
            businessId_userId: {
                businessId,
                userId
            }
        }
    });

    if (existingStaff) {
        throw new AppError(409, 'User is already a staff member in this business');
    }

    const newStaff = await prisma.businessStaff.create({
        data: {
            businessId,
            userId,
            permissionRole
        },
        select: {
            id: true,
            businessId: true,
            userId: true,
            permissionRole: true,
            createdAt: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true
                }
            }
        }
    });

    return newStaff;
};

export const StaffService = {
    addStaff
};
