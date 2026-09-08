import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import { SubscriptionStatus } from '../../../generated/prisma/enums';
import { pushJob } from '../../../utils/redisQueue';
import {
  subscriptionSearchableFields,
  subscriptionFilterableFields,
} from './subscription.constant';

const formatSubscriptionItem = (sub: any) => {
  const latestPayment = sub.payments && sub.payments.length > 0 ? sub.payments[0] : null;

  return {
    id: sub.id,
    businessId: sub.businessId,
    businessName: sub.business?.name || null,
    status: sub.status,
    plan: null,
    billingCycle: 'MONTHLY',
    billingAmount: latestPayment ? Number(latestPayment.amount) : null,
    currency: latestPayment?.currency || 'BDT',
    startDate: sub.createdAt,
    nextBillingDate: sub.nextBillingDate,
    endDate: sub.nextBillingDate,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
    business: sub.business
      ? {
          id: sub.business.id,
          name: sub.business.name,
          email: sub.business.email,
          phone: sub.business.phone,
          status: sub.business.status,
          owner: sub.business.owner
            ? {
                id: sub.business.owner.id,
                fullName: sub.business.owner.fullName,
                email: sub.business.owner.email,
              }
            : null,
        }
      : null,
    latestPayment: latestPayment
      ? {
          id: latestPayment.id,
          amount: Number(latestPayment.amount),
          currency: latestPayment.currency,
          gateway: latestPayment.gateway,
          status: latestPayment.status,
          createdAt: latestPayment.createdAt,
        }
      : null,
  };
};

const getAllSubscriptions = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, unknown> = { ...query };

  // Map 'search' to 'searchTerm' for QueryBuilder consistency
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  const subscriptionQueryBuilder = new QueryBuilder(
    prisma.platformSubscription,
    queryParams as any,
    {
      searchableFields: subscriptionSearchableFields,
      filterableFields: subscriptionFilterableFields,
    }
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      business: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      payments: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          gateway: true,
          status: true,
          createdAt: true,
        },
      },
    });

  const result = await subscriptionQueryBuilder.execute();

  const formattedData = result.data.map(formatSubscriptionItem);

  return {
    meta: result.meta,
    data: formattedData,
  };
};

const updateSubscriptionStatus = async (
  businessId: string,
  status: SubscriptionStatus,
  adminId: string
) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    // 1. Verify business exists
    const business = await tx.business.findUnique({
      where: { id: businessId },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        subscription: true,
      },
    });

    if (!business) {
      throw new AppError(404, 'Business not found');
    }

    // 2. Verify subscription exists for this business
    if (!business.subscription) {
      throw new AppError(404, 'Subscription not found for this business');
    }

    const previousStatus = business.subscription.status;

    // 3. Atomically update subscription status (only modifying subscription state, leaving Business.status, payment history, and billing dates intact)
    const updatedSubscription = await tx.platformSubscription.update({
      where: { businessId },
      data: { status },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        payments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            currency: true,
            gateway: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      updatedSubscription,
      previousStatus,
      business,
    };
  });

  // 4. Record administrative audit log
  console.log(
    `[AUDIT] SUPER_ADMIN ${adminId} changed Business ${businessId} subscription status: ${transactionResult.previousStatus} -> ${status} at ${new Date().toISOString()}`
  );

  // 5. Asynchronously trigger notification & email through Redis worker queue
  await pushJob('notification_queue', {
    eventType: 'SUBSCRIPTION_STATUS_UPDATED',
    businessId: transactionResult.business.id,
    businessName: transactionResult.business.name,
    ownerId: transactionResult.business.ownerId,
    ownerEmail: transactionResult.business.owner?.email,
    ownerName: transactionResult.business.owner?.fullName || 'Business Owner',
    previousStatus: transactionResult.previousStatus,
    newStatus: status,
    nextBillingDate: transactionResult.updatedSubscription.nextBillingDate,
  });

  return formatSubscriptionItem(transactionResult.updatedSubscription);
};

export const SubscriptionBillingControlService = {
  getAllSubscriptions,
  updateSubscriptionStatus,
};
