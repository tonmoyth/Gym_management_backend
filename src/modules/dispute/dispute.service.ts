import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import AppError from '../../errors/AppError';
import { QueryBuilder } from '../../utils/queryBuilder';
import httpStatus from 'http-status';

const createDispute = async (userId: string, role: string, payload: any) => {
  if (role === 'MEMBER') {
    // Member dispute creation
    const dispute = await prisma.dispute.create({
      data: {
        userId,
        subject: payload.subject,
        description: payload.description,
        category: payload.category || 'OTHER',
        status: 'OPEN',
      },
      select: {
        id: true,
        subject: true,
        description: true,
        category: true,
        status: true,
        createdAt: true,
        adminReply: true,
        resolvedAt: true,
      },
    });
    return dispute;
  }

  // Check if trainer profile exists for this user
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId },
  });

  if (!trainerProfile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer profile not found.');
  }

  let targetBusinessId: string | null = null;
  // If businessId is provided, verify the trainer is associated with this business
  if (payload.businessId && typeof payload.businessId === 'string' && payload.businessId.trim() !== '') {
    const rawId = payload.businessId.trim();
    const trainerBusiness = await prisma.trainerBusiness.findFirst({
      where: {
        trainerId: trainerProfile.id,
        OR: [{ businessId: rawId }, { id: rawId }],
        isActive: true,
      },
    });

    if (trainerBusiness) {
      targetBusinessId = trainerBusiness.businessId;
    } else {
      const business = await prisma.business.findUnique({
        where: { id: rawId },
      });
      if (business) {
        targetBusinessId = business.id;
      } else {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You are not associated with this business or your application is not active.',
        );
      }
    }
  }

  const dispute = await prisma.dispute.create({
    data: {
      userId,
      trainerId: trainerProfile.id,
      businessId: targetBusinessId,
      subject: payload.subject,
      description: payload.description,
      category: payload.category || 'OTHER',
      status: 'OPEN',
    },
    select: {
      id: true,
      subject: true,
      description: true,
      category: true,
      status: true,
      createdAt: true,
      businessId: true,
      adminReply: true,
      resolvedAt: true,
    }
  });

  return dispute;
};

const getMyDisputes = async (userId: string, query: Record<string, unknown>) => {
  const queryConfig = {
    searchableFields: ['subject', 'description'],
    filterableFields: ['status', 'category'],
  };

  const baseCondition: Prisma.DisputeWhereInput = {
    userId,
  };

  const disputeQuery = new QueryBuilder(prisma.dispute, query as any, queryConfig)
    .search()
    .filter()
    .sort()
    .paginate()
    .where(baseCondition as Record<string, unknown>);

  const [total, result] = await Promise.all([
    disputeQuery.count(),
    disputeQuery.execute()
  ]);
  
  return {
    meta: {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(query.limit) || 10)),
    },
    data: result.data,
  };
};

const getSingleDispute = async (user: { id: string; role: string }, disputeId: string) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profileImage: true,
          role: true,
        },
      },
      trainer: {
        select: {
          id: true,
          userId: true,
          bio: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!dispute) {
    throw new AppError(httpStatus.NOT_FOUND, 'Dispute not found.');
  }

  // Cross-role service-level authorization check:
  // Allowed if user is SUPER_ADMIN or if user is the dispute raiser
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isRaiser = dispute.userId === user.id;

  if (!isSuperAdmin && !isRaiser) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Forbidden: You are not authorized to view this dispute.'
    );
  }

  return dispute;
};

export const DisputeService = {
  createDispute,
  getMyDisputes,
  getSingleDispute,
};
