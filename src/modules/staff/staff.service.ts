import AppError from '../../errors/AppError';
import { prisma } from '../../lib/prisma';
import { StaffPermissionRole } from '../../generated/prisma/enums';
import { QueryBuilder } from '../../utils/queryBuilder';

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

const getStaffList = async (businessId: string, ownerId: string, queryParams: any) => {
    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden: You do not own this business');
    }

    const queryBuilder = new QueryBuilder(prisma.businessStaff, queryParams, {
        searchableFields: ['user.fullName', 'user.email', 'user.phone'],
        filterableFields: ['permissionRole', 'createdAt']
    })
        .where({ businessId })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    profileImage: true
                }
            }
        })
        .fields();

    return await queryBuilder.execute();
};

const updateStaffPermission = async (
    businessId: string,
    staffId: string,
    ownerId: string,
    payload: { permissionRole: StaffPermissionRole }
) => {
    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden: You do not own this business');
    }

    const staff = await prisma.businessStaff.findUnique({
        where: { id: staffId }
    });

    if (!staff) {
        throw new AppError(404, 'Staff not found');
    }

    if (staff.businessId !== businessId) {
        throw new AppError(403, 'Forbidden: Staff does not belong to this business');
    }

    if (staff.permissionRole === payload.permissionRole) {
        return await prisma.businessStaff.findUnique({
            where: { id: staffId },
            select: {
                id: true,
                businessId: true,
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
    }

    const updatedStaff = await prisma.businessStaff.update({
        where: { id: staffId },
        data: {
            permissionRole: payload.permissionRole
        },
        select: {
            id: true,
            businessId: true,
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

    return updatedStaff;
};

const removeStaff = async (businessId: string, staffId: string, ownerId: string) => {
    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden: You do not own this business');
    }

    const staff = await prisma.businessStaff.findUnique({
        where: { id: staffId }
    });

    if (!staff) {
        throw new AppError(404, 'Staff not found');
    }

    if (staff.businessId !== businessId) {
        throw new AppError(403, 'Forbidden: Staff does not belong to this business');
    }

    await prisma.businessStaff.delete({
        where: { id: staffId }
    });

    return null;
};

export const StaffService = {
    addStaff,
    getStaffList,
    updateStaffPermission,
    removeStaff
};
