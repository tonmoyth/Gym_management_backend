import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { paymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await paymentService.initiatePayment(userId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment initiated successfully.",
    data: result,
  });
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const gateway = req.params.gateway || (req.query.gateway as string) || "stripe";
  const rawBody = (req as any).rawBody || req.body;
  const sigHeader =
    req.headers["stripe-signature"] ||
    req.headers["x-signature"] ||
    req.headers["x-webhook-signature"];
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : (sigHeader || "");

  const result = await paymentService.handleWebhook(
    gateway as string,
    signature,
    rawBody,
    req.body,
    {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      headers: req.headers,
    }
  );

  res.status(200).json({
    success: true,
    message: result?.message || "Webhook event processed successfully",
    data: result?.data,
  });
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const queryParams = req.query;

  const result = await paymentService.getMyPayments(userId, queryParams);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment history fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getInvoice = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const id = String(req.params.id);

  const invoiceBuffer = await paymentService.getInvoice(userId, id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${id}.pdf`);
  res.status(200).send(invoiceBuffer);
});

const verifySession = catchAsync(async (req: Request, res: Response) => {
  const sessionId = (req.query.session_id || req.query.sessionId || req.params.sessionId) as string;
  const result = await paymentService.verifySession(sessionId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment session verified successfully",
    data: result,
  });
});

export const paymentController = {
  initiatePayment,
  handleWebhook,
  getMyPayments,
  getInvoice,
  verifySession,
};
