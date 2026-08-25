import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import AppError from '../../errors/AppError';
import { QueryBuilder } from '../../utils/queryBuilder';
import httpStatus from 'http-status';

const createDispute = async (userId: string, payload: any) => {
  // Check if trainer profile exists for this user
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId },
  });

  if (!trainerProfile) {
    throw new AppError(httpStatus.NOT_FOUND, 'Trainer profile not found.');
  }

  // If businessId is provided, verify the trainer is associated with this business
  if (payload.businessId) {
    const trainerBusiness = await prisma.trainerBusiness.findFirst({
      where: {
        trainerId: trainerProfile.id,
        businessId: payload.businessId,
        isActive: true,
      },
    });

    if (!trainerBusiness) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You are not associated with this business or your application is not active.',
      );
    }
  }

  const dispute = await prisma.dispute.create({
    data: {
      userId,
      trainerId: trainerProfile.id,
      businessId: payload.businessId,
      subject: payload.subject,
      description: payload.description,
      category: payload.category,
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

export const DisputeService = {
  createDispute,
  getMyDisputes,
};
