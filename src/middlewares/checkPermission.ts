import { Request, Response, NextFunction } from 'express';
import { Role, StaffPermissionRole } from '../generated/prisma/enums';
import { prisma } from '../lib/prisma';
import AppError from '../errors/AppError';
import { catchAsync } from '../shared/catchAsync';
import {
    ADMIN_ALLOWED_PLATFORM_PERMISSIONS
} from '../modules/super_admin/role_permission_management/rolePermissionManagement.constant';

declare global {
    namespace Express {
        interface Request {
            staff?: any;
            businessId?: string;
        }
    }
}

const BUSINESS_STAFF_DEFAULT_PERMISSIONS: Record<StaffPermissionRole, string[]> = {
    [StaffPermissionRole.FRONT_DESK]: [
        'MEMBER_READ',
        'ATTENDANCE_READ',
        'ATTENDANCE_CREATE',
        'ATTENDANCE_UPDATE',
        'SCHEDULE_READ'
    ],
    [StaffPermissionRole.FINANCE]: [
        'PAYMENT_READ',
        'PAYMENT_CREATE',
        'PAYMENT_UPDATE',
        'REPORT_READ'
    ],
    [StaffPermissionRole.TRAINER_MANAGER]: [
        'TRAINER_READ',
        'TRAINER_CREATE',
        'TRAINER_UPDATE',
        'TRAINER_MANAGE',
        'SCHEDULE_READ',
        'SCHEDULE_CREATE',
        'SCHEDULE_UPDATE'
    ],
    [StaffPermissionRole.MEMBER_MANAGER]: [
        'MEMBER_READ',
        'MEMBER_CREATE',
        'MEMBER_UPDATE',
        'MEMBERSHIP_READ',
        'MEMBERSHIP_CREATE',
        'MEMBERSHIP_UPDATE'
    ],
    [StaffPermissionRole.FULL]: [
        'MEMBER_READ',
        'MEMBER_CREATE',
        'MEMBER_UPDATE',
        'MEMBER_DELETE',
        'ATTENDANCE_READ',
        'ATTENDANCE_CREATE',
        'ATTENDANCE_UPDATE',
        'ATTENDANCE_DELETE',
        'PAYMENT_READ',
        'PAYMENT_CREATE',
        'PAYMENT_UPDATE',
        'PAYMENT_REFUND',
        'TRAINER_READ',
        'TRAINER_CREATE',
        'TRAINER_UPDATE',
        'TRAINER_DELETE',
        'TRAINER_MANAGE',
        'SCHEDULE_READ',
        'SCHEDULE_CREATE',
        'SCHEDULE_UPDATE',
        'SCHEDULE_DELETE',
        'REPORT_READ'
    ]
};

/**
 * Middleware to enforce granular platform and business permissions.
 * Must be preceded by `checkAuth()`.
 * 
 * - SUPER_ADMIN bypasses all permission checks (platform superuser).
 * - Platform ADMIN / STAFF are evaluated based on their platform permissions (`user.permissions`).
 * - BUSINESS_OWNER inherently possesses all permissions within their own businesses.
 * - Business STAFF are evaluated against their assigned `BusinessStaff` relation.
 */
export const checkPermission = (...requiredPermissions: string[]) => {
    return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) {
            throw new AppError(401, 'You are not authorized');
        }

        if (!user.isActive) {
            throw new AppError(403, 'Your account has been suspended. Please contact support.');
        }

        // 1. SUPER_ADMIN has platform-wide unrestricted access
        if (user.role === Role.SUPER_ADMIN) {
            return next();
        }

        // 2. Platform-level ADMIN / STAFF evaluation
        if (user.role === Role.ADMIN || user.role === Role.STAFF) {
            // Check if user has platform permissions directly on user model
            const assignedPermissions: string[] = Array.isArray(user.permissions)
                ? user.permissions
                : [];

            const effectivePermissions: string[] =
                assignedPermissions.length > 0
                    ? assignedPermissions
                    : user.role === Role.ADMIN
                    ? [...ADMIN_ALLOWED_PLATFORM_PERMISSIONS]
                    : [];

            const hasAllPlatformPermissions = requiredPermissions.every((perm) =>
                effectivePermissions.includes(perm)
            );

            if (hasAllPlatformPermissions) {
                return next();
            }

            throw new AppError(403, 'Forbidden. You do not have the required permissions.');
        }

        // 3. Resolve requested business context for business-level users
        const requestedBusinessId = (
            req.params.businessId ||
            req.query.businessId ||
            (req.headers['x-business-id'] as string) ||
            req.body?.businessId
        );

        // 4. BUSINESS_OWNER has full permission within their own business
        if (user.role === Role.BUSINESS_OWNER) {
            if (requestedBusinessId) {
                const owned = await prisma.business.findFirst({
                    where: {
                        id: String(requestedBusinessId),
                        ownerId: user.id
                    }
                });
                if (!owned) {
                    throw new AppError(403, 'Forbidden: You do not own this business');
                }
                req.businessId = owned.id;
            }
            return next();
        }

        // 5. Business-level staff evaluation
        if (requestedBusinessId) {
            const staffRecord = await prisma.businessStaff.findUnique({
                where: {
                    businessId_userId: {
                        businessId: String(requestedBusinessId),
                        userId: user.id
                    }
                }
            });

            if (!staffRecord) {
                throw new AppError(403, 'Forbidden: You do not have access to this business');
            }

            const staffPermissions =
                BUSINESS_STAFF_DEFAULT_PERMISSIONS[staffRecord.permissionRole] || [];

            const hasAllBusinessPermissions = requiredPermissions.every((perm) =>
                staffPermissions.includes(perm)
            );

            if (hasAllBusinessPermissions) {
                req.staff = staffRecord;
                req.businessId = staffRecord.businessId;
                return next();
            }
        }

        throw new AppError(403, 'Forbidden. You do not have the required permissions.');
    });
};
