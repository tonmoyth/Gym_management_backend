import express, { Application, Request, Response } from "express";
import cors from "cors";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import router from "./routes";
import { paymentController } from "./modules/Payment/payment.controller";
// import { paymentController } from './modules/payment/payment.controller';

const app: Application = express();

app.all("/api/auth/*splat", toNodeHandler(auth));




app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);


app.use(express.json());

app.use(cors());
app.use(cookieParser());

// application routes
app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.send("Gym Management Backend is running");
});

// Global error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  const statusCode = err.statusCode || (err.name === "ZodError" || err.issues ? 400 : 500);
  const message = err.issues?.[0]?.message || err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    error: err.issues || err,
  });
});

export default app;
