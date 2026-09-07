import { z } from "zod";

export const registerReferralValidation = z.object({
  body: z.object({
    referralCode: z.string({ message: "Referral code is required" }),
    email: z.string({ message: "Email is required" }).email(),
    businessId: z.string({ message: "Business ID is required" }).uuid(),
  }),
});

export const ReferralValidations = {
  registerReferralValidation,
};
