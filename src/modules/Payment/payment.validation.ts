import { z } from "zod";
import { PaymentGateway } from "../../generated/prisma/enums";

const initiatePaymentSchema = z.object({
  body: z.object({
    membershipId: z.string().uuid({ message: "Invalid membership ID" }),
    gateway: z.nativeEnum(PaymentGateway),
    amount: z.number().optional(),
    senderPhone: z.string().optional(),
    transactionId: z.string().optional(),
    paymentAccountId: z.string().optional(),
  }),
});

export const paymentValidation = {
  initiatePaymentSchema,
};
