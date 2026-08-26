import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { paymentController } from "./payment.controller";
import { paymentValidation } from "./payment.validation";

const router = express.Router();

router.post(
  "/initiate",
  checkAuth(),
  validateRequest(paymentValidation.initiatePaymentSchema),
  paymentController.initiatePayment
);

router.get(
  "/me",
  checkAuth(),
  paymentController.getMyPayments
);

router.get(
  "/:id/invoice",
  checkAuth(),
  paymentController.getInvoice
);

export const paymentRoutes = router;
