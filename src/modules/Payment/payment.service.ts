// import { PaymentStatus, SubscriptionPlan } from "../../generated/prisma/enums";
// import { stripe } from "../../config/stripeConfig";
// import { envVeriables } from "../../config/envConfig";
// import AppError from "../../errors/AppError";
// import { prisma } from "../../lib/prisma";
// import { notificationService } from "../notification/notification.service";
// import { NotificationType } from "../../generated/prisma/enums";

// type StripeEvent = ReturnType<typeof stripe.webhooks.constructEvent>;
// type CheckoutSession = Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
// type PaymentIntent = Awaited<ReturnType<typeof stripe.paymentIntents.create>>;

// /**
//  * Creates a Stripe checkout session for a premium subscription
//  */
// const createCheckoutSession = async (
//   userId: string,
//   payload: { subscriptionName: string; plan: SubscriptionPlan; amount: number }
// ) => {

//   const { subscriptionName, plan, amount } = payload;

//   // 1. Verify User Exists
//   const user = await prisma.user.findUnique({
//     where: { id: userId },
//   });

//   if (!user) {
//     throw new AppError(404, "User not found");
//   }

//   // 2. Prevent duplicate active subscriptions (but allow renewal/upgrade)
//   const existingActiveSubscription = await prisma.subscription.findFirst({
//     where: {
//       userId,
//       status: PaymentStatus.COMPLETED,
//       expiresAt: {
//         gt: new Date(),
//       },
//     },
//   });

//   // If there's an existing active subscription, decide what to do:
//   // - If it's the same plan, block duplicate purchase.
//   // - If it's a different plan, update the existing subscription to PENDING
//   //   so the user can complete a checkout to upgrade/renew that record.
//   let subscription: any;
//   if (existingActiveSubscription) {
//     // block if user is trying to buy the same active plan
//     if (existingActiveSubscription.plan === plan) {
//       throw new AppError(400, "You already have an active subscription for this plan");
//     }

//     // different plan -> mark existing as PENDING and reuse it for checkout
//     subscription = await prisma.subscription.update({
//       where: { id: existingActiveSubscription.id },
//       data: {
//         subscriptionName,
//         plan,
//         amount,
//         status: PaymentStatus.PENDING,
//         startsAt: null,
//         expiresAt: null,
//         transactionId: null,
//         paymentMethod: null,
//       },
//     });
//   } else {
//     // Create a new PENDING subscription record when no active subscription exists
//     subscription = await prisma.subscription.create({
//       data: {
//         userId,
//         subscriptionName,
//         plan,
//         amount,
//         status: PaymentStatus.PENDING,
//       },
//     });
//   }

//   // 4. Create Stripe Checkout Session
//   const session = await stripe.checkout.sessions.create({
//     payment_method_types: ["card"],
//     mode: "payment",
//     line_items: [
//       {
//         price_data: {
//           currency: "usd",
//           product_data: {
//             name: `${subscriptionName} (${plan})`,
//           },
//           unit_amount: Math.round(amount * 100), // convert to cents
//         },
//         quantity: 1,
//       },
//     ],
//     success_url: `${envVeriables.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${envVeriables.FRONTEND_URL}/payment/cancel`,
//     payment_intent_data: {
//       metadata: {
//         subscriptionId: subscription.id,
//         userId,
//         plan,
//       },
//     },
//     metadata: {
//       subscriptionId: subscription.id,
//       userId,
//       plan,
//     },
//     // Stripe requires expires_at to be at least 30 minutes in the future (default 1 hour)
//     expires_at: Math.floor(Date.now() / 1000) + 3600,
//   });

//   return {
//     checkoutUrl: session.url,
//     sessionId: session.id,
//   };
// };

// /**
//  * Handles Stripe webhook events
//  */
// const handlerStripeWebhookEvent = async (
//   signature: string,
//   rawBody: string | Buffer
// ) => {
//   let event: StripeEvent;

//   try {
//     event = stripe.webhooks.constructEvent(
//       rawBody,
//       signature,
//       envVeriables.STRIPE_WEBHOOK_SECRET
//     );
//   } catch (err: any) {
//     throw new AppError(400, `Webhook Error: ${err.message}`);
//   }

//   switch (event.type) {
//     case "checkout.session.completed": {
//       const session = event.data.object as CheckoutSession;
//       const subscriptionId = session.metadata?.subscriptionId;

//       if (!subscriptionId) break;

//       const startsAt = new Date();
//       const expiresAt = new Date();
//       expiresAt.setDate(expiresAt.getDate() + 30); // Active for 30 days (1 month)

//       const updatedSub = await prisma.subscription.update({
//         where: { id: subscriptionId },
//         data: {
//           status: PaymentStatus.COMPLETED,
//           transactionId: session.payment_intent as string,
//           paymentMethod: session.payment_method_types?.[0],
//           startsAt,
//           expiresAt,
//         },
//       });

//       await notificationService.sendPushNotification({
//         receiverId: updatedSub.userId,
//         title: "Subscription Activated",
//         body: `Your ${updatedSub.plan} subscription is now active!`,
//         type: NotificationType.SUBSCRIPTION,
//       });

//       break;
//     }

//     case "checkout.session.expired": {
//       const session = event.data.object as CheckoutSession;
//       const subscriptionId = session.metadata?.subscriptionId;

//       if (!subscriptionId) break;

//       await prisma.subscription.update({
//         where: { id: subscriptionId },
//         data: {
//           status: PaymentStatus.FAILED,
//         },
//       });
//       break;
//     }

//     case "payment_intent.payment_failed": {
//       const paymentIntent = event.data.object as PaymentIntent;
//       const subscriptionId = paymentIntent.metadata?.subscriptionId;

//       if (subscriptionId) {
//         await prisma.subscription.update({
//           where: { id: subscriptionId },
//           data: {
//             status: PaymentStatus.FAILED,
//           },
//         });
//       }
//       break;
//     }

//     default:
//       console.log(`Unhandled event type ${event.type}`);
//   }

//   return { success: true };
// };

// /**
//  * Fetches the active or most recent subscription for a user
//  */
// const getMySubscription = async (userId: string) => {
//   const subscription = await prisma.subscription.findFirst({
//     where: { userId },
//     orderBy: { createdAt: "desc" },
//   });

//   const isActive =
//     subscription?.status === PaymentStatus.COMPLETED &&
//     subscription?.expiresAt &&
//     subscription.expiresAt > new Date();

//   const remainingDays =
//     isActive && subscription?.expiresAt
//       ? Math.max(0, Math.ceil((subscription.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
//       : 0;

//   return {
//     plan: subscription?.plan || SubscriptionPlan.FREE,
//     amount: subscription?.amount || 0,
//     status: subscription?.status || null,
//     startsAt: subscription?.startsAt || null,
//     expiresAt: subscription?.expiresAt || null,
//     remainingDays,
//     isActive: !!isActive,
//   };
// };

// /**
//  * Helper to check active premium subscription tier
//  */
// const checkPremiumAccess = async (userId: string): Promise<SubscriptionPlan> => {
//   const activeSub = await prisma.subscription.findFirst({
//     where: {
//       userId,
//       status: PaymentStatus.COMPLETED,
//       expiresAt: {
//         gt: new Date(),
//       },
//     },
//   });

//   return activeSub ? activeSub.plan : SubscriptionPlan.FREE;
// };

// export const paymentService = {
//   createCheckoutSession,
//   handlerStripeWebhookEvent,
//   getMySubscription,
//   checkPremiumAccess,
// };
