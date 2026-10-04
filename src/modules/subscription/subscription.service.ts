import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import {
  SubscriptionStatus,
  PaymentStatus,
  PaymentGateway,
  PaymentPurpose,
  NotificationType,
  Role,
  BusinessSubscriptionStatus,
  SubscriptionPaymentStatus,
  PaymentAccountType,
  SubscriptionPlanStatus,
} from "../../generated/prisma/enums";
import { stripe } from "../../config/stripeConfig";
import { envVeriables } from "../../config/envConfig";
import httpStatus from "http-status";
import { auditLogger } from "../../utils/auditLogger";
import { NotificationService } from "../../utils/notification.service";
import { pushJob } from "../../utils/redisQueue";
import Stripe from "stripe";

const getMySubscription = async (ownerId: string, query: any) => {
  const business = await prisma.business.findUnique({
    where: { ownerId },
    include: {
      subscription: true,
    },
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
        data: [],
      },
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
      data: formattedPayments,
    },
  };
};

const handleSubscriptionWebhook = async (
  signature: string,
  rawBody: any,
  parsedBody?: any,
  reqMeta?: { ipAddress?: string; userAgent?: string; headers?: Record<string, any> }
) => {
  let eventType = "";
  let subscriptionId: string | undefined;
  let businessId: string | undefined;
  let invoiceId: string | undefined;
  let amount: number | null = null;
  let currency = "BDT";

  const hasStripeSignature = !!(
    signature &&
    (signature.includes("t=") || reqMeta?.headers?.["stripe-signature"])
  );

  // 1. Webhook Signature Verification
  if (hasStripeSignature) {
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        envVeriables.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      throw new AppError(httpStatus.BAD_REQUEST, `Webhook Error: ${err.message}`);
    }

    eventType = event.type;
    const eventObj = event.data.object as any;

    subscriptionId = eventObj.metadata?.subscriptionId;
    businessId = eventObj.metadata?.businessId;
    invoiceId = eventObj.id;
    if (eventObj.amount_paid !== undefined) {
      amount = eventObj.amount_paid / 100;
    } else if (eventObj.amount_due !== undefined) {
      amount = eventObj.amount_due / 100;
    }
    currency = eventObj.currency?.toUpperCase() || "BDT";
  } else {
    // Check generic/gateway signature token
    const token =
      signature ||
      reqMeta?.headers?.["x-signature"] ||
      reqMeta?.headers?.["x-webhook-signature"];

    if (!token) {
      throw new AppError(httpStatus.BAD_REQUEST, "Missing subscription webhook signature");
    }

    const payload =
      parsedBody ||
      (typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody) ||
      {};

    eventType =
      payload.eventType || payload.type || payload.status || "SUBSCRIPTION_STATUS";
    subscriptionId = payload.subscriptionId;
    businessId = payload.businessId;
    invoiceId = payload.invoiceId || payload.transactionId;
    amount = payload.amount ? Number(payload.amount) : null;
    currency = payload.currency || "BDT";
  }

  // 2. Identify Subscription
  let subscription = null;
  if (subscriptionId) {
    subscription = await prisma.platformSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        business: {
          include: {
            owner: true,
          },
        },
        payments: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  if (!subscription && businessId) {
    subscription = await prisma.platformSubscription.findUnique({
      where: { businessId },
      include: {
        business: {
          include: {
            owner: true,
          },
        },
        payments: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscription not found for webhook event");
  }

  const normalizedEventType = eventType.toLowerCase();

  // 3. Handle Supported States & Idempotency
  // A. Subscription Paid / Active
  if (
    normalizedEventType === "invoice.paid" ||
    normalizedEventType === "invoice.payment_succeeded" ||
    normalizedEventType === "subscription_active" ||
    normalizedEventType === "active"
  ) {
    // Idempotency: check if invoice already recorded as successful payment
    if (invoiceId) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          subscriptionId: subscription.id,
          gatewayTransactionId: invoiceId,
          status: PaymentStatus.SUCCESS,
        },
      });

      if (existingPayment) {
        await auditLogger.record({
          actorId: subscription.business.ownerId,
          action: "SUBSCRIPTION_WEBHOOK_DUPLICATE_IGNORED",
          resource: "SUBSCRIPTION",
          resourceId: subscription.id,
          businessId: subscription.businessId,
          details: `Duplicate paid invoice webhook for subscription ${subscription.id} ignored.`,
          metadata: { invoiceId, eventType },
          ipAddress: reqMeta?.ipAddress,
          userAgent: reqMeta?.userAgent,
        });

        return {
          message: "Subscription webhook already processed (idempotent)",
          data: subscription,
        };
      }
    }

    const nextBilling = new Date();
    nextBilling.setDate(nextBilling.getDate() + 30);

    const result = await prisma.$transaction(async (tx) => {
      const updatedSub = await tx.platformSubscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingDate: nextBilling,
        },
      });

      const payment = await tx.payment.create({
        data: {
          payerUserId: subscription.business.ownerId,
          subscriptionId: subscription.id,
          amount: amount ? amount : 1000.0,
          currency,
          gateway: PaymentGateway.STRIPE,
          gatewayTransactionId: invoiceId || `SUB-INV-${Date.now()}`,
          purpose: PaymentPurpose.PLATFORM_SUBSCRIPTION,
          status: PaymentStatus.SUCCESS,
        },
      });

      return { updatedSub, payment };
    });

    await auditLogger.record({
      actorId: subscription.business.ownerId,
      action: "SUBSCRIPTION_STATUS_UPDATED",
      resource: "SUBSCRIPTION",
      resourceId: subscription.id,
      businessId: subscription.businessId,
      details: `Subscription for ${subscription.business.name} activated/renewed via webhook`,
      metadata: {
        previousStatus: subscription.status,
        newStatus: SubscriptionStatus.ACTIVE,
        nextBillingDate: nextBilling,
        invoiceId,
      },
      ipAddress: reqMeta?.ipAddress,
      userAgent: reqMeta?.userAgent,
    });

    await NotificationService.createNotification(
      subscription.business.ownerId,
      "Subscription Active! 🎉",
      `Your platform subscription for ${subscription.business.name} is now active. Next billing date: ${nextBilling.toLocaleDateString()}.`,
      NotificationType.SYSTEM,
      {
        subscriptionId: subscription.id,
        businessId: subscription.businessId,
        status: SubscriptionStatus.ACTIVE,
      }
    );

    await pushJob("notification_queue", {
      eventType: "SUBSCRIPTION_STATUS_UPDATED",
      businessId: subscription.businessId,
      businessName: subscription.business.name,
      ownerId: subscription.business.ownerId,
      ownerEmail: subscription.business.owner?.email,
      newStatus: SubscriptionStatus.ACTIVE,
      nextBillingDate: nextBilling,
    });

    return {
      message: "Subscription marked ACTIVE successfully",
      data: result.updatedSub,
    };
  }

  // B. Subscription Payment Failed / Overdue
  if (
    normalizedEventType === "invoice.payment_failed" ||
    normalizedEventType === "subscription_overdue" ||
    normalizedEventType === "overdue"
  ) {
    const updatedSub = await prisma.$transaction(async (tx) => {
      const sub = await tx.platformSubscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.OVERDUE,
        },
      });

      if (invoiceId) {
        await tx.payment.create({
          data: {
            payerUserId: subscription.business.ownerId,
            subscriptionId: subscription.id,
            amount: amount ? amount : 1000.0,
            currency,
            gateway: PaymentGateway.STRIPE,
            gatewayTransactionId: invoiceId,
            purpose: PaymentPurpose.PLATFORM_SUBSCRIPTION,
            status: PaymentStatus.FAILED,
          },
        });
      }

      return sub;
    });

    await auditLogger.record({
      actorId: subscription.business.ownerId,
      action: "SUBSCRIPTION_STATUS_UPDATED",
      resource: "SUBSCRIPTION",
      resourceId: subscription.id,
      businessId: subscription.businessId,
      details: `Subscription for ${subscription.business.name} marked OVERDUE via webhook`,
      metadata: {
        previousStatus: subscription.status,
        newStatus: SubscriptionStatus.OVERDUE,
        invoiceId,
      },
      ipAddress: reqMeta?.ipAddress,
      userAgent: reqMeta?.userAgent,
    });

    await NotificationService.createNotification(
      subscription.business.ownerId,
      "Subscription Payment Overdue ⚠️",
      `The payment for your platform subscription for ${subscription.business.name} failed and is overdue. Please update your payment method.`,
      NotificationType.SYSTEM,
      {
        subscriptionId: subscription.id,
        businessId: subscription.businessId,
        status: SubscriptionStatus.OVERDUE,
      }
    );

    await pushJob("notification_queue", {
      eventType: "SUBSCRIPTION_STATUS_UPDATED",
      businessId: subscription.businessId,
      businessName: subscription.business.name,
      ownerId: subscription.business.ownerId,
      ownerEmail: subscription.business.owner?.email,
      newStatus: SubscriptionStatus.OVERDUE,
    });

    return {
      message: "Subscription marked OVERDUE successfully",
      data: updatedSub,
    };
  }

  // C. Subscription Cancelled / Inactive
  if (
    normalizedEventType === "customer.subscription.deleted" ||
    normalizedEventType === "subscription_inactive" ||
    normalizedEventType === "inactive"
  ) {
    const updatedSub = await prisma.platformSubscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.INACTIVE,
      },
    });

    await auditLogger.record({
      actorId: subscription.business.ownerId,
      action: "SUBSCRIPTION_STATUS_UPDATED",
      resource: "SUBSCRIPTION",
      resourceId: subscription.id,
      businessId: subscription.businessId,
      details: `Subscription for ${subscription.business.name} marked INACTIVE via webhook`,
      metadata: {
        previousStatus: subscription.status,
        newStatus: SubscriptionStatus.INACTIVE,
      },
      ipAddress: reqMeta?.ipAddress,
      userAgent: reqMeta?.userAgent,
    });

    await NotificationService.createNotification(
      subscription.business.ownerId,
      "Subscription Cancelled",
      `Your platform subscription for ${subscription.business.name} has ended.`,
      NotificationType.SYSTEM,
      {
        subscriptionId: subscription.id,
        businessId: subscription.businessId,
        status: SubscriptionStatus.INACTIVE,
      }
    );

    await pushJob("notification_queue", {
      eventType: "SUBSCRIPTION_STATUS_UPDATED",
      businessId: subscription.businessId,
      businessName: subscription.business.name,
      ownerId: subscription.business.ownerId,
      ownerEmail: subscription.business.owner?.email,
      newStatus: SubscriptionStatus.INACTIVE,
    });

    return {
      message: "Subscription marked INACTIVE successfully",
      data: updatedSub,
    };
  }

  return {
    message: `Subscription webhook event ${eventType} acknowledged`,
    data: subscription,
  };
};

const getActivePlans = async (query: Record<string, unknown>) => {
  const queryParams: Record<string, any> = { ...query, status: 'ACTIVE' };
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  const queryBuilder = new QueryBuilder(
    prisma.subscriptionPlan,
    queryParams as any,
    {
      searchableFields: ['name', 'description'],
      filterableFields: ['billingCycle', 'status', 'searchTerm'],
    }
  )
    .where({ status: 'ACTIVE' })
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

const getSuperAdminPaymentAccounts = async () => {
  const accounts = await prisma.paymentAccount.findMany({
    where: {
      status: 'ACTIVE',
      businessId: null,
      trainerId: null,
      user: {
        role: Role.SUPER_ADMIN,
      },
    },
    select: {
      id: true,
      accountType: true,
      accountName: true,
      accountNumber: true,
      bankName: true,
      branchName: true,
      routingNumber: true,
      isDefault: true,
      status: true,
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return accounts;
};

const getSubscriptionStatus = async (userId: string) => {
  const businessInclude = {
    businessSubscription: {
      include: {
        subscriptionPlan: true,
      },
    },
    subscriptionPayments: {
      take: 10,
      orderBy: { createdAt: 'desc' as const },
      include: {
        paymentAccount: {
          select: {
            accountType: true,
            accountName: true,
            bankName: true,
          },
        },
      },
    },
  };

  let business = await prisma.business.findUnique({
    where: { ownerId: userId },
    include: businessInclude,
  });

  if (!business) {
    const staff = await prisma.businessStaff.findFirst({
      where: { userId },
      select: { businessId: true },
    });
    if (staff) {
      business = await prisma.business.findUnique({
        where: { id: staff.businessId },
        include: businessInclude,
      });
    }
  }

  if (!business) {
    throw new AppError(404, 'Business profile not found.');
  }

  const sub = business.businessSubscription;
  const now = new Date();
  let isExpired = false;
  let daysRemaining = 0;

  if (sub) {
    if (sub.status === BusinessSubscriptionStatus.ACTIVE) {
      if (sub.endDate && new Date(sub.endDate) < now) {
        isExpired = true;
        // Dynamically transition to EXPIRED in database
        await prisma.businessSubscription.update({
          where: { id: sub.id },
          data: { status: BusinessSubscriptionStatus.EXPIRED },
        });
        sub.status = BusinessSubscriptionStatus.EXPIRED;
      } else if (sub.endDate) {
        daysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(sub.endDate).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
      }
    } else if (sub.status === BusinessSubscriptionStatus.EXPIRED) {
      isExpired = true;
    }
  }

  return {
    businessId: business.id,
    businessName: business.name,
    businessStatus: business.status,
    hasActiveBusiness: business.status === 'ACTIVE',
    subscription: sub
      ? {
          id: sub.id,
          status: sub.status,
          planName: sub.planName,
          planPrice: Number(sub.planPrice),
          billingCycle: sub.billingCycle,
          features: sub.features,
          startDate: sub.startDate,
          endDate: sub.endDate,
          isExpired,
          daysRemaining,
          canRenew:
            isExpired ||
            daysRemaining <= 7 ||
            sub.status === BusinessSubscriptionStatus.PENDING,
        }
      : null,
    recentPayments: business.subscriptionPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      transactionId: p.transactionId,
      status: p.status,
      rejectionReason: p.rejectionReason,
      paymentAccount: p.paymentAccount,
      createdAt: p.createdAt,
    })),
  };
};

const submitSubscriptionPayment = async (
  ownerId: string,
  payload: {
    subscriptionPlanId: string;
    paymentAccountId: string;
    paymentMethod: PaymentAccountType;
    transactionId: string;
    paymentProof?: string;
  }
) => {
  const business = await prisma.business.findUnique({
    where: { ownerId },
    include: {
      owner: true,
      businessSubscription: true,
    },
  });

  if (!business) {
    throw new AppError(
      404,
      'Business profile not found. Please complete business setup first.'
    );
  }

  // 1. Fetch Plan and strictly enforce price server-side
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: payload.subscriptionPlanId },
  });

  if (!plan) {
    throw new AppError(404, 'Subscription plan not found.');
  }

  if (plan.status !== SubscriptionPlanStatus.ACTIVE) {
    throw new AppError(
      400,
      'The selected subscription plan is currently inactive and cannot be subscribed to.'
    );
  }

  // 2. Validate receiving Super Admin payment account
  const paymentAccount = await prisma.paymentAccount.findUnique({
    where: { id: payload.paymentAccountId },
    include: { user: true },
  });

  if (
    !paymentAccount ||
    paymentAccount.status !== 'ACTIVE' ||
    paymentAccount.user?.role !== Role.SUPER_ADMIN ||
    paymentAccount.businessId !== null ||
    paymentAccount.trainerId !== null
  ) {
    throw new AppError(
      400,
      'Invalid destination payment account. Please select an active Super Admin payment account.'
    );
  }

  if (paymentAccount.accountType !== payload.paymentMethod) {
    throw new AppError(
      400,
      `Payment method mismatch: Selected destination account is ${paymentAccount.accountType}, but payment method specified is ${payload.paymentMethod}.`
    );
  }

  // 3. Check for duplicate transaction ID submission
  const existingPayment = await prisma.subscriptionPayment.findUnique({
    where: {
      paymentMethod_transactionId: {
        paymentMethod: payload.paymentMethod,
        transactionId: payload.transactionId.trim(),
      },
    },
  });

  if (existingPayment) {
    throw new AppError(
      409,
      'A payment with this transaction ID has already been submitted.'
    );
  }

  // 4. Create Payment and ensure BusinessSubscription is PENDING in a transaction
  const result = await prisma.$transaction(async (tx) => {
    let subscription = business.businessSubscription;
    if (!subscription) {
      subscription = await tx.businessSubscription.create({
        data: {
          businessId: business.id,
          subscriptionPlanId: plan.id,
          status: BusinessSubscriptionStatus.PENDING,
          planName: plan.name,
          planPrice: plan.price,
          billingCycle: plan.billingCycle,
          features: plan.features,
        },
      });
    }

    const payment = await tx.subscriptionPayment.create({
      data: {
        businessId: business.id,
        businessSubscriptionId: subscription.id,
        subscriptionPlanId: plan.id,
        amount: plan.price, // strictly derived server-side
        currency: 'BDT',
        paymentMethod: payload.paymentMethod,
        transactionId: payload.transactionId.trim(),
        paymentProof: payload.paymentProof?.trim(),
        paymentAccountId: paymentAccount.id,
        status: SubscriptionPaymentStatus.PENDING,
        planName: plan.name,
        billingCycle: plan.billingCycle,
        features: plan.features,
      },
    });

    return { payment, subscription };
  });

  // 5. In-app notification to Owner
  try {
    await NotificationService.createNotification(
      ownerId,
      'Subscription Payment Submitted',
      'Your subscription payment has been submitted and is currently pending verification by administration.',
      NotificationType.SYSTEM,
      {
        businessId: business.id,
        paymentId: result.payment.id,
        status: 'PENDING',
      }
    );
  } catch (e: any) {
    console.error('Failed to create in-app notification:', e.message);
  }

  // 6. Record Audit Log
  await auditLogger.record({
    actorId: ownerId,
    action: 'SUBSCRIPTION_PAYMENT_SUBMITTED',
    resource: 'SUBSCRIPTION_PAYMENT',
    resourceId: result.payment.id,
    businessId: business.id,
    details: `Submitted ৳${result.payment.amount} subscription payment (${result.payment.paymentMethod} Trx: ${result.payment.transactionId})`,
    metadata: {
      planId: plan.id,
      planName: plan.name,
      amount: Number(result.payment.amount),
      paymentMethod: result.payment.paymentMethod,
      transactionId: result.payment.transactionId,
    },
  });

  return result;
};

const renewSubscription = async (
  ownerId: string,
  payload: {
    subscriptionPlanId: string;
    paymentAccountId: string;
    paymentMethod: PaymentAccountType;
    transactionId: string;
    paymentProof?: string;
  }
) => {
  const result = await submitSubscriptionPayment(ownerId, payload);

  // Record Audit Log specifically for renewal
  await auditLogger.record({
    actorId: ownerId,
    action: 'SUBSCRIPTION_RENEWAL_REQUESTED',
    resource: 'SUBSCRIPTION_PAYMENT',
    resourceId: result.payment.id,
    businessId: result.payment.businessId,
    details: `Requested subscription renewal for plan ${result.payment.planName}`,
    metadata: {
      paymentId: result.payment.id,
      planId: result.payment.subscriptionPlanId,
    },
  });

  return result;
};

const getPaymentHistory = async (
  ownerId: string,
  query: Record<string, unknown>
) => {
  const business = await prisma.business.findUnique({
    where: { ownerId },
  });

  if (!business) {
    throw new AppError(404, 'Business profile not found.');
  }

  const queryParams = { ...query };
  if (queryParams.search && !queryParams.searchTerm) {
    queryParams.searchTerm = queryParams.search;
  }
  delete queryParams.search;

  const queryBuilder = new QueryBuilder(
    prisma.subscriptionPayment,
    queryParams as any,
    {
      searchableFields: ['transactionId', 'planName'],
      filterableFields: ['status', 'paymentMethod', 'searchTerm'],
    }
  )
    .where({ businessId: business.id })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      subscriptionPlan: true,
      paymentAccount: {
        select: {
          id: true,
          accountType: true,
          accountName: true,
          bankName: true,
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

export const SubscriptionService = {
  getMySubscription,
  handleSubscriptionWebhook,
  getActivePlans,
  getSuperAdminPaymentAccounts,
  getSubscriptionStatus,
  submitSubscriptionPayment,
  renewSubscription,
  getPaymentHistory,
};
