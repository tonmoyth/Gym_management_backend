// import { Request, Response } from "express";
// import { catchAsync } from "../../shared/catchAsync";
// import { paymentService } from "./payment.service";

// /**
//  * Creates a premium subscription checkout session
//  */
// const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
//   const userId = req.user.id;
//   const result = await paymentService.createCheckoutSession(userId, req.body);

//   res.status(200).json({
//     success: true,
//     message: "payment created seccussfully",
//     data: result,
//   });
// });

// /**
//  * Webhook handler for Stripe payment events
//  */
// const handlerStripeWebhookEvent = catchAsync(async (req: Request, res: Response) => {
//   const signature = req.headers["stripe-signature"] as string;


//   // Note: req.body must be raw buffer for Stripe signature verification to succeed
//   await paymentService.handlerStripeWebhookEvent(
//     signature,
//     req.body
//   );

//   res.status(200).json({
//     success: true,
//     message: "Stripe webhook event processed successfully",
//   });
// });

// /**
//  * Fetches current active/recent subscription for logged in user
//  */
// const getMySubscription = catchAsync(async (req: Request, res: Response) => {
//   const userId = req.user.id;
//   const result = await paymentService.getMySubscription(userId);

//   res.status(200).json({
//     success: true,
//     message: "Subscription fetched successfully",
//     data: result,
//   });
// });

// export const paymentController = {
//   createCheckoutSession,
//   handlerStripeWebhookEvent,
//   getMySubscription,
// };
