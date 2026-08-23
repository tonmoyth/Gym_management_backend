import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";

const getMySubscription = async (ownerId: string, query: any) => {
  const business = await prisma.business.findUnique({
    where: { ownerId },
    include: {
      subscription: true
    }
  });

  if (!business) {
    throw new AppError(404, "Business profile not found.");
  }

  const subscription = business.subscription;

  if (!subscription) {
    return {
      subscription: null,
      billingHistory: {
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        data: []
      }
    };
  }

  const queryBuilder = new QueryBuilder(prisma.payment, query, {
    searchableFields: [],
  })
    .filter()
    .where({ subscriptionId: subscription.id })
    .sort()
    .paginate();

  const [total, result] = await Promise.all([
    queryBuilder.count(),
    queryBuilder.execute(),
  ]);

  const formattedPayments = result.data.map((payment: any) => ({
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    gateway: payment.gateway,
    status: payment.status,
    purpose: payment.purpose,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  }));

  return {
    subscription: {
      id: subscription.id,
      status: subscription.status,
      nextBillingDate: subscription.nextBillingDate,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    },
    billingHistory: {
      meta: {
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
        total,
        totalPages: Math.ceil(total / (Number(query.limit) || 10)),
      },
      data: formattedPayments
    }
  };
};

export const SubscriptionService = {
  getMySubscription,
};
