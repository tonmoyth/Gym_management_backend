import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { Role } from '../../../generated/prisma/enums';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { hashPassword, generateRandomString } from 'better-auth/crypto';
import {
    ICreateStaffPayload,
    IUpdateStaffPermissionPayload,
    ISanitizedStaffResponse
} from './rolePermissionManagement.interface';
import {
    ALL_PLATFORM_PERMISSIONS,
    PLATFORM_SUPER_ADMIN_ONLY_PERMISSIONS,
    PRIVILEGED_PLATFORM_PERMISSIONS,
    STAFF_ALLOWED_PLATFORM_PERMISSIONS,
    ADMIN_ALLOWED_PLATFORM_PERMISSIONS,
    PLATFORM_PERMISSION_GROUPS,
    STAFF_MANAGEABLE_ROLES,
    platformStaffSearchableFields,
    platformStaffFilterableFields
} from './rolePermissionManagement.constant';

/**
 * Validates a list of permissions against the target platform role.
 */
const validatePlatformPermissions = (permissions: string[], role: 'ADMIN' | 'STAFF') => {
    for (const perm of permissions) {
        // 1. Must be a valid known platform permission
        if (!ALL_PLATFORM_PERMISSIONS.includes(perm as any)) {
            throw new AppError(400, `Invalid platform permission: '${perm}'.`);
        }

        // 2. Platform superuser permissions cannot be assigned to ADMIN or STAFF
        if (PLATFORM_SUPER_ADMIN_ONLY_PERMISSIONS.includes(perm as any)) {
            throw new AppError(
                400,
                `Permission '${perm}' is reserved for platform SUPER_ADMIN.`
            );
        }

        // 3. STAFF cannot receive privileged platform admin permissions
        if (role === 'STAFF' && (PRIVILEGED_PLATFORM_PERMISSIONS as readonly string[]).includes(perm)) {
            throw new AppError(
                400,
                `Permission '${perm}' is a privileged platform permission and cannot be assigned to a STAFF account. Only platform ADMIN accounts can hold this permission.`
            );
        }
    }
};

/**
 * Creates a new platform-level ADMIN or STAFF account with scoped permissions.
 * Does not require or accept businessId.
 */
const createStaff = async (
    payload: ICreateStaffPayload,
    superAdminId: string
): Promise<ISanitizedStaffResponse> => {
    const normalizedEmail = payload.email.trim().toLowerCase();

    // 1. Role validation: Must be ADMIN or STAFF only
    if (!STAFF_MANAGEABLE_ROLES.includes(payload.role)) {
        throw new AppError(400, 'Invalid role. Only ADMIN or STAFF roles can be created through this endpoint.');
    }

    // 2. Permissions validation
    if (!payload.permissions || payload.permissions.length === 0) {
        throw new AppError(400, 'At least one platform permission must be assigned.');
    }
    validatePlatformPermissions(payload.permissions, payload.role);

    // 3. Email uniqueness check
    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail }
    });

    if (existingUser) {
        throw new AppError(409, 'Email already exists');
    }

    // 4. Secure password hashing with Better Auth crypto engine
    const passwordHash = await hashPassword(payload.password);
    const userId = generateRandomString(32);
    const accountId = generateRandomString(32);

    // 5. Prisma transaction for atomic user and account creation
    const user = await prisma.$transaction(async (tx) => {
        // Create platform User record
        const createdUser = await tx.user.create({
            data: {
                id: userId,
                fullName: payload.name.trim(),
                email: normalizedEmail,
                role: payload.role as Role,
                permissions: payload.permissions,
                isActive: true,
                isVerified: true,
                emailVerified: true
            }
        });

        // Create Account record with hashed credentials
        await tx.account.create({
            data: {
                id: accountId,
                accountId: userId,
                providerId: 'credential',
                userId,
                password: passwordHash
            }
        });

        return createdUser;
    });

    // 6. Audit log
    console.log(
        `[AUDIT] SUPER_ADMIN ${superAdminId} created platform ${payload.role} account ${user.id} (${user.email}) with permissions: [${payload.permissions.join(', ')}] at ${new Date().toISOString()}`
    );

    return {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'ACTIVE' : 'SUSPENDED',
        permissions: user.permissions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
};

/**
 * Lists platform-level ADMIN and STAFF accounts using QueryBuilder with search, filtering, pagination, and sorting.
 * Excludes SUPER_ADMIN, MEMBER, TRAINER, and Business Owner staff accounts.
 */
const getStaffList = async (queryParams: any) => {
    const { role, status, ...restQuery } = queryParams;

    // Scope strictly to platform ADMIN and STAFF accounts (no gym business staff)
    const whereConditions: any = {
        role: { in: [Role.ADMIN, Role.STAFF] },
        staffRoles: { none: {} }
    };

    if (role) {
        if (STAFF_MANAGEABLE_ROLES.includes(role)) {
            whereConditions.role = role as Role;
        }
    }

    if (status) {
        whereConditions.isActive = status === 'ACTIVE';
    }

    const queryBuilder = new QueryBuilder(prisma.user, restQuery, {
        searchableFields: platformStaffSearchableFields,
        filterableFields: platformStaffFilterableFields
    })
        .where(whereConditions)
        .search()
        .filter()
        .sort()
        .paginate()
        .fields();

    const result = await queryBuilder.execute();

    // Map to sanitized output response
    const sanitizedData = result.data.map((user: any) => ({
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'ACTIVE' : 'SUSPENDED',
        permissions: user.permissions || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    }));

    return {
        meta: result.meta,
        data: sanitizedData
    };
};

/**
 * Updates a platform-level ADMIN or STAFF user's permission scope using replacement semantics.
 */
const updateStaffPermission = async (
    id: string,
    payload: IUpdateStaffPermissionPayload,
    superAdminId: string
): Promise<ISanitizedStaffResponse> => {
    const user = await prisma.user.findUnique({
        where: { id },
        include: { staffRoles: true }
    });

    if (!user) {
        throw new AppError(404, 'Platform Staff/Admin account not found');
    }

    // SUPER_ADMIN accounts cannot be modified through this module
    if (user.role === Role.SUPER_ADMIN) {
        throw new AppError(403, 'Forbidden: Cannot modify SUPER_ADMIN accounts through this module.');
    }

    // Business Owner staff accounts cannot be modified through this platform endpoint
    if (user.staffRoles && user.staffRoles.length > 0) {
        throw new AppError(
            400,
            'Cannot modify Business Owner staff accounts through this platform endpoint. Use business staff management instead.'
        );
    }

    // Must be a platform ADMIN or STAFF account
    if (user.role !== Role.ADMIN && user.role !== Role.STAFF) {
        throw new AppError(400, 'User is not a platform ADMIN or STAFF account.');
    }

    // Validate new role if provided
    let targetRole: 'ADMIN' | 'STAFF' = user.role as 'ADMIN' | 'STAFF';
    if (payload.role) {
        if (!STAFF_MANAGEABLE_ROLES.includes(payload.role)) {
            throw new AppError(400, 'Invalid role. Only ADMIN or STAFF roles are supported.');
        }
        targetRole = payload.role;
    }

    // Validate permissions if provided
    if (payload.permissions !== undefined) {
        if (!Array.isArray(payload.permissions)) {
            throw new AppError(400, 'Permissions must be an array of strings.');
        }
        validatePlatformPermissions(payload.permissions, targetRole);
    }

    const previousPermissions = user.permissions || [];
    const newPermissions = payload.permissions !== undefined
        ? payload.permissions
        : previousPermissions;

    const newIsActive = payload.status !== undefined
        ? payload.status === 'ACTIVE'
        : user.isActive;

    // Prisma transaction to apply updates safely
    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            role: targetRole as Role,
            permissions: newPermissions,
            isActive: newIsActive
        }
    });

    // Audit log
    console.log(
        `[AUDIT] SUPER_ADMIN ${superAdminId} updated platform account ${user.id} (${user.email}). Role: ${targetRole}, Permissions: [${newPermissions.join(', ')}], Status: ${newIsActive ? 'ACTIVE' : 'SUSPENDED'} at ${new Date().toISOString()}`
    );

    return {
        id: updatedUser.id,
        name: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.isActive ? 'ACTIVE' : 'SUSPENDED',
        permissions: updatedUser.permissions,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
    };
};

/**
 * Deactivates a platform-level ADMIN or STAFF account and revokes active sessions (soft deletion lifecycle).
 */
const removeStaff = async (id: string, superAdminId: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        include: { staffRoles: true }
    });

    if (!user) {
        throw new AppError(404, 'Platform Staff/Admin account not found');
    }

    // SUPER_ADMIN accounts cannot be deleted or deactivated through this module
    if (user.role === Role.SUPER_ADMIN) {
        throw new AppError(403, 'Forbidden: Cannot remove or deactivate SUPER_ADMIN accounts.');
    }

    // Business Owner staff accounts cannot be removed through this platform endpoint
    if (user.staffRoles && user.staffRoles.length > 0) {
        throw new AppError(
            400,
            'Cannot remove Business Owner staff accounts through this platform endpoint. Use business staff management instead.'
        );
    }

    // Must be a platform ADMIN or STAFF account
    if (user.role !== Role.ADMIN && user.role !== Role.STAFF) {
        throw new AppError(400, 'User is not a platform ADMIN or STAFF account.');
    }

    // Atomic deactivation: deactivate user and revoke active sessions
    await prisma.$transaction(async (tx) => {
        // 1. Deactivate user account
        await tx.user.update({
            where: { id: user.id },
            data: { isActive: false }
        });

        // 2. Revoke all active login sessions immediately
        await tx.session.deleteMany({
            where: { userId: user.id }
        });
    });

    // Audit log
    console.log(
        `[AUDIT] SUPER_ADMIN ${superAdminId} deactivated platform staff user ${user.id} (${user.email}) and revoked all active sessions at ${new Date().toISOString()}`
    );

    return null;
};

/**
 * Returns all available platform permissions, organized as a flat list,
 * role-specific lists, and categorized functional groups for frontend consumption.
 */
const getAllPermissions = () => {
    return {
        all: ALL_PLATFORM_PERMISSIONS,
        grouped: PLATFORM_PERMISSION_GROUPS,
        staffAllowed: STAFF_ALLOWED_PLATFORM_PERMISSIONS,
        adminAllowed: ADMIN_ALLOWED_PLATFORM_PERMISSIONS,
        privileged: PRIVILEGED_PLATFORM_PERMISSIONS
    };
};

export const RolePermissionManagementService = {
    createStaff,
    getStaffList,
    getAllPermissions,
    updateStaffPermission,
    removeStaff
};
