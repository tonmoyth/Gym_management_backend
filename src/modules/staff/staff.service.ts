import AppError from '../../errors/AppError';
import { prisma } from '../../lib/prisma';
import { Role, StaffPermissionRole } from '../../generated/prisma/enums';
import { QueryBuilder } from '../../utils/queryBuilder';

const addStaff = async (
    businessId: string,
    ownerId: string,
    payload: { userId?: string; email?: string; permissionRole: StaffPermissionRole }
) => {
    const { userId, email, permissionRole } = payload;

    const business = await prisma.business.findUnique({
        where: { id: businessId }
    });

    if (!business) {
        throw new AppError(404, 'Business not found');
    }

    if (business.ownerId !== ownerId) {
        throw new AppError(403, 'Forbidden: You do not own this business');
    }

    let user;
    if (email) {
        user = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() }
        });
    } else if (userId) {
        user = await prisma.user.findUnique({
            where: { id: userId }
        });
    }

    if (!user) {
        throw new AppError(
            404,
            email
                ? `No registered user found with email "${email}". The user must register an account on the platform first.`
                : 'User not found'
        );
    }

    if (user.id === ownerId) {
        throw new AppError(400, 'Business owner cannot be added as staff to their own business');
    }

    const existingStaff = await prisma.businessStaff.findUnique({
        where: {
            businessId_userId: {
                businessId,
                userId: user.id
            }
        }
    });

    if (existingStaff) {
        throw new AppError(409, 'This user is already a staff member in this business');
    }

    const newStaff = await prisma.businessStaff.create({
        data: {
            businessId,
            userId: user.id,
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

    // If user's role is MEMBER, elevate to STAFF for gym portal access
    if (user.role === Role.MEMBER) {
        await prisma.user.update({
            where: { id: user.id },
            data: { role: Role.STAFF }
        });
    }

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
        searchableFields: ['user.fullName', 'user.email'],
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

    // If user has no other staff positions, restore role back to MEMBER
    const remainingStaffCount = await prisma.businessStaff.count({
        where: { userId: staff.userId }
    });
    if (remainingStaffCount === 0) {
        const user = await prisma.user.findUnique({
            where: { id: staff.userId },
            select: { role: true }
        });
        if (user && user.role === Role.STAFF) {
            await prisma.user.update({
                where: { id: staff.userId },
                data: { role: Role.MEMBER }
            });
        }
    }

    return null;
};

export const StaffService = {
    addStaff,
    getStaffList,
    updateStaffPermission,
    removeStaff
};
