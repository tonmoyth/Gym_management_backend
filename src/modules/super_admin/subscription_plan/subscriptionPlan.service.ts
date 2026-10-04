import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { auditLogger } from '../../../utils/auditLogger';
import {
  ICreateSubscriptionPlanPayload,
  IUpdateSubscriptionPlanPayload,
} from './subscriptionPlan.interface';
import {
  subscriptionPlanSearchableFields,
  subscriptionPlanFilterableFields,
} from './subscriptionPlan.constant';

const createPlan = async (
  adminId: string,
  payload: ICreateSubscriptionPlanPayload
) => {
  const existingPlan = await prisma.subscriptionPlan.findUnique({
    where: { name: payload.name.trim() },
  });

  if (existingPlan) {
    throw new AppError(
      409,
      `A SaaS subscription plan named "${payload.name}" already exists.`
    );
  }

  const defaultDuration =
    payload.durationDays || (payload.billingCycle === 'YEARLY' ? 365 : 30);

  const newPlan = await prisma.subscriptionPlan.create({
    data: {
      name: payload.name.trim(),
      description: payload.description?.trim(),
      price: payload.price,
      billingCycle: payload.billingCycle,
      durationDays: defaultDuration,
      features: payload.features.map((f) => f.trim()),
      status: payload.status || 'ACTIVE',
    },
  });

  // Record Audit Log
  await auditLogger.record({
    actorId: adminId,
    action: 'SUBSCRIPTION_PLAN_CREATED',
    resource: 'SUBSCRIPTION_PLAN',
    resourceId: newPlan.id,
    details: `Created SaaS plan: ${newPlan.name} (${newPlan.billingCycle} - ৳${newPlan.price})`,
    metadata: {
      planName: newPlan.name,
      price: Number(newPlan.price),
      billingCycle: newPlan.billingCycle,
      featuresCount: newPlan.features.length,
    },
  });

  return newPlan;
};

const getAllPlans = async (query: Record<string, unknown>) => {
  const queryParams = { ...query };
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  const queryBuilder = new QueryBuilder(
    prisma.subscriptionPlan,
    queryParams as any,
    {
      searchableFields: subscriptionPlanSearchableFields,
      filterableFields: subscriptionPlanFilterableFields,
    }
  )
    .search()
    .filter()
    .sort()
    .paginate();

  const [total, result] = await Promise.all([
    queryBuilder.count(),
    queryBuilder.execute(),
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

const getPlanById = async (id: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          businessSubscriptions: true,
          subscriptionPayments: true,
        },
      },
    },
  });

  if (!plan) {
    throw new AppError(404, 'SaaS subscription plan not found.');
  }

  return plan;
};

const updatePlan = async (
  id: string,
  adminId: string,
  payload: IUpdateSubscriptionPlanPayload
) => {
  const existingPlan = await prisma.subscriptionPlan.findUnique({
    where: { id },
  });

  if (!existingPlan) {
    throw new AppError(404, 'SaaS subscription plan not found.');
  }

  if (payload.name && payload.name.trim() !== existingPlan.name) {
    const duplicate = await prisma.subscriptionPlan.findUnique({
      where: { name: payload.name.trim() },
    });
    if (duplicate && duplicate.id !== id) {
      throw new AppError(
        409,
        `Another SaaS subscription plan with the name "${payload.name}" already exists.`
      );
    }
  }

  const updatedPlan = await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      name: payload.name?.trim(),
      description:
        payload.description !== undefined
          ? payload.description.trim()
          : undefined,
      price: payload.price,
      billingCycle: payload.billingCycle,
      durationDays: payload.durationDays,
      features: payload.features
        ? payload.features.map((f) => f.trim())
        : undefined,
      status: payload.status,
    },
  });

  // Record Audit Log
  await auditLogger.record({
    actorId: adminId,
    action: 'SUBSCRIPTION_PLAN_UPDATED',
    resource: 'SUBSCRIPTION_PLAN',
    resourceId: updatedPlan.id,
    details: `Updated SaaS plan: ${updatedPlan.name}`,
    metadata: {
      planName: updatedPlan.name,
      price: Number(updatedPlan.price),
      billingCycle: updatedPlan.billingCycle,
      status: updatedPlan.status,
    },
  });

  return updatedPlan;
};

const deleteOrDeactivatePlan = async (id: string, adminId: string) => {
  const existingPlan = await prisma.subscriptionPlan.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          businessSubscriptions: true,
          subscriptionPayments: true,
        },
      },
    },
  });

  if (!existingPlan) {
    throw new AppError(404, 'SaaS subscription plan not found.');
  }

  const hasSubscriptions =
    existingPlan._count.businessSubscriptions > 0 ||
    existingPlan._count.subscriptionPayments > 0;

  let result: any;
  let actionTaken: string;

  if (hasSubscriptions) {
    // Cannot destructively delete a plan tied to businesses/payments
    result = await prisma.subscriptionPlan.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    actionTaken = 'DEACTIVATED';
  } else {
    result = await prisma.subscriptionPlan.delete({
      where: { id },
    });
    actionTaken = 'DELETED';
  }

  // Record Audit Log
  await auditLogger.record({
    actorId: adminId,
    action: `SUBSCRIPTION_PLAN_${actionTaken}`,
    resource: 'SUBSCRIPTION_PLAN',
    resourceId: id,
    details: `${actionTaken === 'DEACTIVATED' ? 'Deactivated' : 'Deleted'} SaaS subscription plan: ${existingPlan.name}`,
  });

  return {
    action: actionTaken,
    plan: result,
  };
};

export const SubscriptionPlanService = {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deleteOrDeactivatePlan,
};
