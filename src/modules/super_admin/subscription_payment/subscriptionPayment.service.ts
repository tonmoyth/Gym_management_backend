import { prisma } from '../../../lib/prisma';
import AppError from '../../../errors/AppError';
import { QueryBuilder } from '../../../utils/queryBuilder';
import {
  BusinessStatus,
  BusinessSubscriptionStatus,
  NotificationType,
  SubscriptionPaymentStatus,
} from '../../../generated/prisma/enums';
import { NotificationService } from '../../../utils/notification.service';
import { pushJob } from '../../../utils/redisQueue';
import { auditLogger } from '../../../utils/auditLogger';
import {
  subscriptionPaymentSearchableFields,
  subscriptionPaymentFilterableFields,
} from './subscriptionPayment.constant';
import { IRejectPaymentPayload } from './subscriptionPayment.interface';

const getAllSubscriptionPayments = async (query: Record<string, unknown>) => {
  const queryParams = { ...query };
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  const queryBuilder = new QueryBuilder(
    prisma.subscriptionPayment,
    queryParams as any,
    {
      searchableFields: subscriptionPaymentSearchableFields,
      filterableFields: subscriptionPaymentFilterableFields,
    }
  )
    .search()
    .filter();

  // Date range filtering
  if (query.startDate || query.endDate) {
    const createdAtFilter: Record<string, Date> = {};
    if (query.startDate) {
      createdAtFilter.gte = new Date(query.startDate as string);
    }
    if (query.endDate) {
      createdAtFilter.lte = new Date(query.endDate as string);
    }
    queryBuilder.where({ createdAt: createdAtFilter });
  }

  queryBuilder
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
      subscriptionPlan: {
        select: {
          id: true,
          name: true,
          price: true,
          billingCycle: true,
          durationDays: true,
          features: true,
        },
      },
      paymentAccount: {
        select: {
          id: true,
          accountType: true,
          accountName: true,
          accountNumber: true,
          bankName: true,
          branchName: true,
        },
      },
      reviewedByAdmin: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    });

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

const getSubscriptionPaymentById = async (id: string) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id },
    include: {
      business: {
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          businessSubscription: true,
        },
      },
      subscriptionPlan: true,
      paymentAccount: true,
      reviewedByAdmin: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(404, 'SaaS subscription payment not found.');
  }

  return payment;
};

const approvePayment = async (id: string, adminId: string) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id },
    include: {
      business: {
        include: {
          owner: true,
          businessSubscription: true,
        },
      },
      subscriptionPlan: true,
    },
  });

  if (!payment) {
    throw new AppError(404, 'SaaS subscription payment not found.');
  }

  if (payment.status !== SubscriptionPaymentStatus.PENDING) {
    throw new AppError(
      400,
      `Cannot approve payment. Current status is ${payment.status}.`
    );
  }

  const durationDays =
    payment.subscriptionPlan.durationDays ||
    (payment.billingCycle === 'YEARLY' ? 365 : 30);

  const existingSub = payment.business.businessSubscription;
  const now = new Date();

  // Renewal stacking calculation
  let newStartDate: Date;
  if (
    existingSub &&
    existingSub.status === BusinessSubscriptionStatus.ACTIVE &&
    existingSub.endDate &&
    new Date(existingSub.endDate) > now
  ) {
    newStartDate = new Date(existingSub.endDate);
  } else {
    newStartDate = now;
  }

  const newEndDate = new Date(
    newStartDate.getTime() + durationDays * 24 * 60 * 60 * 1000
  );

  const transactionResult = await prisma.$transaction(async (tx) => {
    // 1. Update Payment status to APPROVED
    const updatedPayment = await tx.subscriptionPayment.update({
      where: { id },
      data: {
        status: SubscriptionPaymentStatus.APPROVED,
        reviewedByAdminId: adminId,
        reviewedAt: now,
      },
    });

    // 2. Upsert/Update BusinessSubscription to ACTIVE
    const updatedSubscription = await tx.businessSubscription.upsert({
      where: { businessId: payment.businessId },
      update: {
        subscriptionPlanId: payment.subscriptionPlanId,
        status: BusinessSubscriptionStatus.ACTIVE,
        startDate: newStartDate,
        endDate: newEndDate,
        planName: payment.planName,
        planPrice: payment.subscriptionPlan.price,
        billingCycle: payment.billingCycle,
        features: payment.features,
      },
      create: {
        businessId: payment.businessId,
        subscriptionPlanId: payment.subscriptionPlanId,
        status: BusinessSubscriptionStatus.ACTIVE,
        startDate: newStartDate,
        endDate: newEndDate,
        planName: payment.planName,
        planPrice: payment.subscriptionPlan.price,
        billingCycle: payment.billingCycle,
        features: payment.features,
      },
    });

    // 3. Link subscription to payment
    await tx.subscriptionPayment.update({
      where: { id },
      data: { businessSubscriptionId: updatedSubscription.id },
    });

    // 4. Activate Business if currently PENDING_APPROVAL
    let updatedBusiness = payment.business;
    if (payment.business.status === BusinessStatus.PENDING_APPROVAL) {
      updatedBusiness = await tx.business.update({
        where: { id: payment.businessId },
        data: { status: BusinessStatus.ACTIVE },
        include: { owner: true, businessSubscription: true },
      });
    }

    return {
      payment: updatedPayment,
      subscription: updatedSubscription,
      business: updatedBusiness,
    };
  });

  // 5. In-app Notification to Business Owner
  if (payment.business.ownerId) {
    try {
      await NotificationService.createNotification(
        payment.business.ownerId,
        'Subscription Payment Approved 🎉',
        'Your subscription payment has been approved. Your gym is now active!',
        NotificationType.SYSTEM,
        {
          businessId: payment.businessId,
          paymentId: payment.id,
          subscriptionId: transactionResult.subscription.id,
          status: 'ACTIVE',
        }
      );
    } catch (e: any) {
      console.error('Failed to create in-app notification:', e.message);
    }
  }

  // 6. Redis Queue job for background email / activation
  await pushJob('notification_queue', {
    eventType: 'BUSINESS_APPROVED',
    businessId: payment.businessId,
    businessName: payment.business.name,
    ownerId: payment.business.ownerId,
    ownerEmail: payment.business.owner?.email,
    ownerName: payment.business.owner?.fullName || 'Business Owner',
  });

  // 7. Record Audit Log
  await auditLogger.record({
    actorId: adminId,
    action: 'SUBSCRIPTION_PAYMENT_APPROVED',
    resource: 'SUBSCRIPTION_PAYMENT',
    resourceId: payment.id,
    businessId: payment.businessId,
    details: `Approved ৳${payment.amount} subscription payment for business: ${payment.business.name}`,
    metadata: {
      paymentId: payment.id,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      planName: payment.planName,
      billingCycle: payment.billingCycle,
      startDate: newStartDate,
      endDate: newEndDate,
    },
  });

  return transactionResult;
};

const rejectPayment = async (
  id: string,
  adminId: string,
  payload: IRejectPaymentPayload
) => {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id },
    include: {
      business: {
        include: {
          owner: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(404, 'SaaS subscription payment not found.');
  }

  if (payment.status !== SubscriptionPaymentStatus.PENDING) {
    throw new AppError(
      400,
      `Cannot reject payment. Current status is ${payment.status}.`
    );
  }

  const updatedPayment = await prisma.subscriptionPayment.update({
    where: { id },
    data: {
      status: SubscriptionPaymentStatus.REJECTED,
      rejectionReason: payload.rejectionReason.trim(),
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    },
  });

  // In-app Notification to Business Owner
  if (payment.business.ownerId) {
    try {
      await NotificationService.createNotification(
        payment.business.ownerId,
        'Subscription Payment Rejected ⚠️',
        `Your subscription payment was rejected. Reason: ${payload.rejectionReason}. Please submit a valid payment.`,
        NotificationType.SYSTEM,
        {
          businessId: payment.businessId,
          paymentId: payment.id,
          status: 'REJECTED',
          reason: payload.rejectionReason,
        }
      );
    } catch (e: any) {
      console.error('Failed to create in-app notification:', e.message);
    }
  }

  // Record Audit Log
  await auditLogger.record({
    actorId: adminId,
    action: 'SUBSCRIPTION_PAYMENT_REJECTED',
    resource: 'SUBSCRIPTION_PAYMENT',
    resourceId: payment.id,
    businessId: payment.businessId,
    details: `Rejected subscription payment for business: ${payment.business.name}. Reason: ${payload.rejectionReason}`,
    metadata: {
      paymentId: payment.id,
      rejectionReason: payload.rejectionReason,
    },
  });

  return updatedPayment;
};

export const SubscriptionPaymentService = {
  getAllSubscriptionPayments,
  getSubscriptionPaymentById,
  approvePayment,
  rejectPayment,
};
