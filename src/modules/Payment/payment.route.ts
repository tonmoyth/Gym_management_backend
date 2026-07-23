import express from "express";
// import { checkAuth } from "../../middlewares/checkAuth";
// import { paymentController } from "./payment.controller";

const router = express.Router();

// router.post(
//   "/created-payment",
//   checkAuth(),
//   paymentController.createCheckoutSession
// );

// // router.post(
// //   "/webhook",
// //   express.raw({ type: "application/json" }),
// //   paymentController.handlerStripeWebhookEvent
// // );

// router.get(
//   "/my-subscription",
//   checkAuth(),
//   paymentController.getMySubscription
// );

export const paymentRoutes = router;

