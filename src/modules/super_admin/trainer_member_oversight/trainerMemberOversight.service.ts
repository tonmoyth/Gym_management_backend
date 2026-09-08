import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { Role } from '../../../generated/prisma/enums';
import { pushJob } from '../../../utils/redisQueue';
import {
  userSearchableFields,
  userFilterableFields,
  allowedOversightRoles,
} from './trainerMemberOversight.constant';
import { UserAccountStatus } from './trainerMemberOversight.interface';

const getAllUsers = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, unknown> = { ...query };

  // Map 'search' parameter to 'searchTerm' for QueryBuilder
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  // Map 'status' (ACTIVE / SUSPENDED) to 'isActive' ('true' / 'false') for Prisma User model
  if (queryParams.status) {
    if (queryParams.status === 'ACTIVE') {
      queryParams.isActive = 'true';
    } else if (queryParams.status === 'SUSPENDED') {
      queryParams.isActive = 'false';
    }
    delete queryParams.status;
  }

  // Strict Role Restriction: Only MEMBER and TRAINER are ever allowed
  let targetRoles: Role[] = [...allowedOversightRoles];
  if (
    queryParams.role &&
    allowedOversightRoles.includes(queryParams.role as Role)
  ) {
    targetRoles = [queryParams.role as Role];
  }
  // Delete role from filterParams to ensure client input cannot bypass or widen role restriction
  delete queryParams.role;

  const userQueryBuilder = new QueryBuilder(
    prisma.user,
    queryParams as any,
    {
      searchableFields: userSearchableFields,
      filterableFields: userFilterableFields,
    }
  )
    .where({
      role: { in: targetRoles },
    })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      memberProfile: {
        select: {
          id: true,
          memberships: {
            select: {
              id: true,
              status: true,
              business: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            take: 5,
          },
        },
      },
      trainerProfile: {
        select: {
          id: true,
          businesses: {
            select: {
              id: true,
              isActive: true,
              business: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            take: 5,
          },
        },
      },
    });

  const result = await userQueryBuilder.execute();

  // Format and sanitize response (never expose passwords, tokens, or sessions)
  const formattedData = result.data.map((user: any) => {
    let businessInfo = null;

    if (
      user.role === Role.TRAINER &&
      user.trainerProfile?.businesses &&
      user.trainerProfile.businesses.length > 0
    ) {
      businessInfo = user.trainerProfile.businesses.map((tb: any) => ({
        id: tb.business?.id,
        name: tb.business?.name,
        isActive: tb.isActive,
      }));
    } else if (
      user.role === Role.MEMBER &&
      user.memberProfile?.memberships &&
      user.memberProfile.memberships.length > 0
    ) {
      businessInfo = user.memberProfile.memberships.map((m: any) => ({
        id: m.business?.id,
        name: m.business?.name,
        status: m.status,
      }));
    }

    return {
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.isActive ? 'ACTIVE' : 'SUSPENDED',
      isActive: user.isActive,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      emailVerified: user.emailVerified,
      businesses: businessInfo,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  });

  return {
    meta: result.meta,
    data: formattedData,
  };
};

const updateAccountStatus = async (
  targetUserId: string,
  adminId: string,
  status: UserAccountStatus
) => {
  // Prevent SUPER_ADMIN self-suspension / self-modification
  if (targetUserId === adminId) {
    throw new AppError(
      400,
      'SUPER_ADMIN cannot modify their own account status'
    );
  }

  // Find target user
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError(404, 'User not found');
  }

  // Enforce role restriction: only MEMBER and TRAINER accounts can be modified
  if (!allowedOversightRoles.includes(targetUser.role)) {
    throw new AppError(
      403,
      `Cannot modify account with role ${targetUser.role}. Only MEMBER and TRAINER accounts can be modified.`
    );
  }

  const newIsActive = status === 'ACTIVE';

  // Handle redundant state transition without unnecessary database update
  if (targetUser.isActive === newIsActive) {
    return {
      id: targetUser.id,
      name: targetUser.fullName,
      fullName: targetUser.fullName,
      email: targetUser.email,
      role: targetUser.role,
      status: targetUser.isActive ? 'ACTIVE' : 'SUSPENDED',
      isActive: targetUser.isActive,
      createdAt: targetUser.createdAt,
      updatedAt: targetUser.updatedAt,
    };
  }

  // Update account status only
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isActive: newIsActive,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // When suspending an account, invalidate any active database sessions
  if (!newIsActive) {
    await prisma.session.deleteMany({
      where: { userId: targetUserId },
    });
  }

  // Enqueue notification and email send via Redis worker
  await pushJob('notification_queue', {
    eventType: newIsActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_SUSPENDED',
    userId: updatedUser.id,
    userEmail: updatedUser.email,
    userName: updatedUser.fullName || 'User',
    role: updatedUser.role,
  });

  return {
    id: updatedUser.id,
    name: updatedUser.fullName,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
    role: updatedUser.role,
    status: updatedUser.isActive ? 'ACTIVE' : 'SUSPENDED',
    isActive: updatedUser.isActive,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt,
  };
};

export const TrainerMemberOversightService = {
  getAllUsers,
  updateAccountStatus,
};
