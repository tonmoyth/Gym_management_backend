import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { PaymentStatus, PaymentGateway, PaymentPurpose, BookingStatus } from "../../generated/prisma/enums";
import { stripe } from "../../config/stripeConfig";
import { envVeriables } from "../../config/envConfig";
import { QueryBuilder } from "../../utils/queryBuilder";
import { generateInvoicePDF } from "../../utils/invoiceGenerator";


const initiatePayment = async (userId: string, payload: { membershipId: string; gateway: PaymentGateway }) => {
  const { membershipId, gateway } = payload;

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

  const amount = membership.plan.price;

  let payment = await prisma.payment.findFirst({
    where: {
      membershipId: membership.id,
      status: PaymentStatus.PENDING,
      gateway,
    },
  });

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

const handleWebhook = async (gateway: string, signature: string, rawBody: any) => {
  console.log("this is handle service", gateway, signature, rawBody);
  if (gateway === "stripe") {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        envVeriables.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      throw new AppError(400, `Webhook Error: ${err.message}`);
    }


    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const paymentId = session.metadata?.paymentId;
      const membershipId = session.metadata?.membershipId;

      if (paymentId && membershipId) {
        await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.findUnique({ where: { id: paymentId } });
          if (payment && payment.status === PaymentStatus.PENDING) {
            await tx.payment.update({
              where: { id: paymentId },
              data: {
                status: PaymentStatus.SUCCESS,
                gatewayTransactionId: session.payment_intent as string || session.id,
              },
            });
            // Keeping membership as PENDING_APPROVAL according to requirements
          }
        });
      }
    } else if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
      const session = event.data.object as any;
      const paymentId = session.metadata?.paymentId;
      if (paymentId) {
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.FAILED },
        });
      }
    }
  }
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

export const paymentService = {
  initiatePayment,
  handleWebhook,
  getMyPayments,
  getInvoice,
  processRefund,
};
