import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { PaymentStatus, PaymentGateway, PaymentPurpose, BookingStatus, NotificationType, SubscriptionStatus } from "../../generated/prisma/enums";
import { stripe } from "../../config/stripeConfig";
import { envVeriables } from "../../config/envConfig";
import { QueryBuilder } from "../../utils/queryBuilder";
import { generateInvoicePDF } from "../../utils/invoiceGenerator";
import httpStatus from "http-status";
import { auditLogger } from "../../utils/auditLogger";
import { NotificationService } from "../../utils/notification.service";


const initiatePayment = async (
  userId: string,
  payload: {
    membershipId: string;
    gateway: PaymentGateway;
    amount?: number;
    transactionId?: string;
    senderPhone?: string;
    paymentAccountId?: string;
  }
) => {
  const { membershipId, gateway, transactionId, senderPhone } = payload;

  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError(404, "Member profile not found");

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, memberId: memberProfile.id },
    include: { plan: true },
  });

  if (!membership) throw new AppError(404, "Membership not found or unauthorized");
  if (membership.status === BookingStatus.CANCELLED || membership.status === BookingStatus.EXPIRED) {
    throw new AppError(400, "Cannot pay for a cancelled or expired membership");
  }

  // Check if there's already a successful payment
  const existingPayment = await prisma.payment.findFirst({
    where: {
      membershipId: membership.id,
      status: PaymentStatus.SUCCESS,
    },
  });

  if (existingPayment) {
    throw new AppError(400, "Membership is already paid");
  }

  const amount = payload.amount || membership.plan.price;

  let payment = await prisma.payment.findFirst({
    where: {
      membershipId: membership.id,
      status: PaymentStatus.PENDING,
      gateway,
    },
  });

  const formattedTrx = transactionId
    ? senderPhone
      ? `${transactionId} (Sender: ${senderPhone})`
      : transactionId
    : null;

  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        payerUserId: userId,
        membershipId: membership.id,
        amount,
        currency: "BDT",
        gateway,
        purpose: PaymentPurpose.MEMBERSHIP,
        status: PaymentStatus.PENDING,
        gatewayTransactionId: formattedTrx,
      },
    });
  } else if (formattedTrx) {
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayTransactionId: formattedTrx,
      },
    });
  }

  let paymentUrl = "";

  if (gateway === PaymentGateway.STRIPE) {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "bdt", // Or "usd" depending on the account config
            product_data: {
              name: membership.plan.name,
            },
            unit_amount: Math.round(Number(amount) * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${envVeriables.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${envVeriables.FRONTEND_URL}/payment/cancel`,
      metadata: {
        paymentId: payment.id,
        membershipId: membership.id,
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    paymentUrl = session.url || "";

    // Update the gatewayTransactionId (which is the session id here)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayTransactionId: session.id },
    });
  } else {
    // bKash or others (stubbed for now, should return correct URL)
    paymentUrl = `${envVeriables.FRONTEND_URL}/payment/stub?paymentId=${payment.id}`;
  }

  return { paymentUrl, paymentId: payment.id };
};

const handleWebhook = async (
  gateway: string,
  signature: string,
  rawBody: any,
  parsedBody?: any,
  reqMeta?: { ipAddress?: string; userAgent?: string; headers?: Record<string, any> }
) => {
  // 1. Gateway Validation: Ensure gateway is supported
  const normalizedGateway = (gateway || "").toUpperCase();
  const supportedGateways = Object.values(PaymentGateway) as string[];

  if (!supportedGateways.includes(normalizedGateway)) {
    throw new AppError(httpStatus.BAD_REQUEST, `Unsupported payment gateway: ${gateway}`);
  }

  let eventType = "";
  let paymentId: string | undefined;
  let gatewayTxId: string | undefined;
  let sessionObj: any = null;
  let isSuccessEvent = false;
  let isFailureEvent = false;

  // 2. Gateway Security & Signature Verification
  if (normalizedGateway === PaymentGateway.STRIPE) {
    if (!signature) {
      throw new AppError(httpStatus.BAD_REQUEST, "Missing Stripe webhook signature");
    }

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
    sessionObj = event.data.object as any;

    if (event.type === "checkout.session.completed") {
      isSuccessEvent = true;
      paymentId = sessionObj.metadata?.paymentId;
      gatewayTxId = (sessionObj.payment_intent as string) || sessionObj.id;
    } else if (event.type === "payment_intent.succeeded") {
      isSuccessEvent = true;
      paymentId = sessionObj.metadata?.paymentId;
      gatewayTxId = sessionObj.id;
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "payment_intent.payment_failed"
    ) {
      isFailureEvent = true;
      paymentId = sessionObj.metadata?.paymentId;
      gatewayTxId = (sessionObj.payment_intent as string) || sessionObj.id;
    } else {
      // Ignored non-payment stripe events
      return { message: `Event ${event.type} received and skipped`, data: null };
    }
  } else {
    // For non-Stripe gateways (BKASH, NAGAD, ROCKET):
    const secToken =
      signature ||
      reqMeta?.headers?.["x-signature"] ||
      reqMeta?.headers?.["x-webhook-signature"];
    if (!secToken) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Missing webhook signature for ${normalizedGateway}`
      );
    }

    const payload =
      parsedBody ||
      (typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody) ||
      {};
    eventType = payload.eventType || payload.status || "PAYMENT_CALLBACK";
    paymentId = payload.paymentId || payload.merchantInvoiceNumber;
    gatewayTxId =
      payload.trxID || payload.transactionId || payload.gatewayTransactionId;

    const statusStr = String(payload.status || "").toUpperCase();
    if (
      statusStr === "SUCCESS" ||
      statusStr === "COMPLETED" ||
      statusStr === "PAID"
    ) {
      isSuccessEvent = true;
    } else if (
      statusStr === "FAILED" ||
      statusStr === "CANCELLED" ||
      statusStr === "EXPIRED"
    ) {
      isFailureEvent = true;
    }
  }

  // 3. Find Target Payment Record
  let payment = null;
  if (paymentId) {
    payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { membership: true, subscription: true },
    });
  }

  if (!payment && gatewayTxId) {
    payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { gatewayTransactionId: gatewayTxId },
          {
            gateway: normalizedGateway as PaymentGateway,
            gatewayTransactionId: gatewayTxId,
          },
        ],
      },
      include: { membership: true, subscription: true },
    });
  }

  if (!payment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Payment record not found for webhook event"
    );
  }

  // 4. Webhook Idempotency Check:
  // If payment is already marked SUCCESS, safely skip duplicate processing
  if (payment.status === PaymentStatus.SUCCESS && isSuccessEvent) {
    await auditLogger.record({
      actorId: payment.payerUserId,
      action: "PAYMENT_WEBHOOK_DUPLICATE_IGNORED",
      resource: "PAYMENT",
      resourceId: payment.id,
      details: `Duplicate success webhook received for payment ${payment.id}. Idempotently skipped.`,
      metadata: {
        gateway: normalizedGateway,
        eventType,
        gatewayTransactionId: gatewayTxId,
      },
      ipAddress: reqMeta?.ipAddress,
      userAgent: reqMeta?.userAgent,
    });

    return {
      message: "Webhook event already processed (idempotent)",
      data: payment,
    };
  }

  // Prevent invalid state transitions (e.g. REFUNDED payment turning back to SUCCESS)
  if (payment.status === PaymentStatus.REFUNDED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot update payment status: payment is already refunded"
    );
  }

  // 5. Atomic State Transition & Integration
  if (isSuccessEvent) {
    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          gatewayTransactionId: gatewayTxId || payment.gatewayTransactionId,
        },
        include: {
          membership: true,
          subscription: true,
        },
      });

      // If payment is for platform subscription, activate subscription and advance nextBillingDate
      if (
        payment.subscriptionId ||
        payment.purpose === PaymentPurpose.PLATFORM_SUBSCRIPTION
      ) {
        const subId = payment.subscriptionId;
        if (subId) {
          const nextBilling = new Date();
          nextBilling.setDate(nextBilling.getDate() + 30);

          await tx.platformSubscription.update({
            where: { id: subId },
            data: {
              status: SubscriptionStatus.ACTIVE,
              nextBillingDate: nextBilling,
            },
          });
        }
      }

      return updated;
    });

    // Record Audit Log
    await auditLogger.record({
      actorId: payment.payerUserId,
      action: "PAYMENT_WEBHOOK_SUCCESS",
      resource: "PAYMENT",
      resourceId: payment.id,
      details: `Payment ${payment.id} marked SUCCESS via ${normalizedGateway} webhook (Trx: ${gatewayTxId || "N/A"})`,
      metadata: {
        paymentId: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        gateway: normalizedGateway,
        purpose: payment.purpose,
        gatewayTransactionId: gatewayTxId,
      },
      ipAddress: reqMeta?.ipAddress,
      userAgent: reqMeta?.userAgent,
    });

    // Send In-App Notification
    await NotificationService.createNotification(
      payment.payerUserId,
      "Payment Successful! 💳",
      `Your payment of ${Number(payment.amount).toFixed(2)} ${payment.currency} via ${normalizedGateway} was successful.`,
      NotificationType.PAYOUT,
      {
        paymentId: payment.id,
        gateway: normalizedGateway,
        amount: Number(payment.amount),
        purpose: payment.purpose,
      }
    );

    return {
      message: "Payment processed successfully",
      data: updatedPayment,
    };
  }

  if (isFailureEvent) {
    const updatedPayment = await prisma.$transaction(async (tx) => {
      return await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
    });

    await auditLogger.record({
      actorId: payment.payerUserId,
      action: "PAYMENT_WEBHOOK_FAILED",
      resource: "PAYMENT",
      resourceId: payment.id,
      details: `Payment ${payment.id} marked FAILED via ${normalizedGateway} webhook`,
      metadata: {
        paymentId: payment.id,
        gateway: normalizedGateway,
        eventType,
      },
      ipAddress: reqMeta?.ipAddress,
      userAgent: reqMeta?.userAgent,
    });

    await NotificationService.createNotification(
      payment.payerUserId,
      "Payment Failed",
      `Your payment of ${Number(payment.amount).toFixed(2)} ${payment.currency} via ${normalizedGateway} failed or was cancelled.`,
      NotificationType.SYSTEM,
      {
        paymentId: payment.id,
        gateway: normalizedGateway,
        amount: Number(payment.amount),
      }
    );

    return {
      message: "Payment failure recorded",
      data: updatedPayment,
    };
  }

  return { message: "Webhook event processed", data: null };
};

const getMyPayments = async (userId: string, queryParams: any) => {
  const queryBuilder = new QueryBuilder(prisma.payment, queryParams, {
    filterableFields: ["status", "gateway", "membershipId"],
    searchableFields: [],
  })
    .where({ payerUserId: userId })
    .filter()
    .sort()
    .paginate()
    .include({
      membership: {
        include: { plan: true },
      },
    });

  const result = await queryBuilder.execute();
  return result;
};

const getInvoice = async (userId: string, paymentId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, payerUserId: userId },
    include: {
      membership: {
        include: {
          plan: { include: { business: true } },
        },
      },
      payer: true,
    },
  });

  if (!payment) throw new AppError(404, "Payment not found or unauthorized");

  if (payment.status !== PaymentStatus.SUCCESS) {
    throw new AppError(400, "Invoice is only available for successful payments");
  }

  const pdfBuffer = await generateInvoicePDF(payment);
  return pdfBuffer;
};

const processRefund = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new AppError(404, "Payment not found");
  }

  if (payment.status !== PaymentStatus.SUCCESS) {
    throw new AppError(400, "Only successful payments can be refunded");
  }

  if (payment.gateway === PaymentGateway.STRIPE && payment.gatewayTransactionId) {
    try {
      let paymentIntentId = payment.gatewayTransactionId;

      // If gatewayTransactionId is a checkout session, retrieve the payment intent
      if (paymentIntentId.startsWith('cs_')) {
        const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
        paymentIntentId = session.payment_intent as string;
      }

      if (paymentIntentId) {
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
        });
      }

      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });
    } catch (error: any) {
      console.error("Stripe refund failed:", error.message);
      throw new AppError(500, `Refund failed: ${error.message}`);
    }
  } else {
    // Other gateways
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED },
    });
  }
};

const verifySession = async (sessionId: string) => {
  if (!sessionId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Session ID is required");
  }

  // 1. Retrieve the session from Stripe (safely)
  let session: any = null;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent"],
    });
  } catch (err: any) {
    console.warn(`Stripe checkout.sessions.retrieve warning: ${err.message}`);
  }

  const paymentId = session?.metadata?.paymentId;
  const membershipId = session?.metadata?.membershipId;

  // 2. Look up the payment record in DB
  let payment = null;
  if (paymentId) {
    payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        membership: {
          include: {
            plan: {
              include: { business: true },
            },
          },
        },
        payer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  if (!payment) {
    payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { gatewayTransactionId: sessionId },
          ...(session?.payment_intent
            ? [
                {
                  gatewayTransactionId:
                    typeof session.payment_intent === "string"
                      ? session.payment_intent
                      : session.payment_intent.id,
                },
              ]
            : []),
        ],
      },
      include: {
        membership: {
          include: {
            plan: {
              include: { business: true },
            },
          },
        },
        payer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  if (!session && !payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment session or record not found");
  }

  // 3. If session is paid, ensure payment status is SUCCESS in DB (idempotent)
  const isPaid = (session && session.payment_status === "paid") || payment?.status === PaymentStatus.SUCCESS;
  if (session && session.payment_status === "paid" && payment && payment.status !== PaymentStatus.SUCCESS) {
    const gatewayTxId =
      (typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as any)?.id) || sessionId;

    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCESS,
        gatewayTransactionId: gatewayTxId,
      },
      include: {
        membership: {
          include: {
            plan: {
              include: { business: true },
            },
          },
        },
        payer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    try {
      await auditLogger.record({
        actorId: payment.payerUserId,
        action: "PAYMENT_SUCCESS_VERIFIED",
        resource: "PAYMENT",
        resourceId: payment.id,
        details: `Payment ${payment.id} verified via Stripe session ${sessionId}`,
      });

      await NotificationService.createNotification(
        payment.payerUserId,
        "Payment Successful! 💳",
        `Your payment of ${Number(payment.amount).toFixed(2)} ${payment.currency} via Stripe was successful.`,
        NotificationType.SYSTEM,
        {
          paymentId: payment.id,
          gateway: "STRIPE",
          amount: Number(payment.amount),
          purpose: payment.purpose,
        }
      );
    } catch (logErr) {
      console.error("Audit/notification error during verifySession:", logErr);
    }
  }

  const plan = payment?.membership?.plan;
  const business = plan?.business;

  return {
    isPaid,
    sessionId: session.id,
    paymentId: payment?.id || paymentId || null,
    gatewayTransactionId:
      payment?.gatewayTransactionId ||
      (typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as any)?.id) ||
      session.id,
    amount: payment?.amount
      ? Number(payment.amount)
      : (session.amount_total ? session.amount_total / 100 : 0),
    currency: payment?.currency || session.currency?.toUpperCase() || "BDT",
    status: payment?.status || (isPaid ? PaymentStatus.SUCCESS : PaymentStatus.PENDING),
    payerName: payment?.payer?.fullName || session.customer_details?.name || "Member",
    payerEmail: payment?.payer?.email || session.customer_details?.email || "",
    planName: plan?.name || (session.line_items?.data?.[0] as any)?.description || "Gym Membership Plan",
    planDuration: plan?.durationDays || 30,
    businessName: business?.name || "Fitness Center",
    businessAddress: business?.address || "",
    membershipId: payment?.membershipId || membershipId || null,
    membershipStatus: payment?.membership?.status || "PENDING_APPROVAL",
    paymentDate: payment?.createdAt ? payment.createdAt.toISOString() : new Date().toISOString(),
  };
};

export const paymentService = {
  initiatePayment,
  handleWebhook,
  getMyPayments,
  getInvoice,
  processRefund,
  verifySession,
};
