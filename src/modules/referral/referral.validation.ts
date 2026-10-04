import { z } from "zod";

export const registerReferralValidation = z.object({
  body: z.object({
    referralCode: z.string({ message: "Referral code is required" }),
    email: z.string({ message: "Email is required" }).email(),
    businessId: z.string({ message: "Business ID is required" }).uuid(),
  }),
});

export const registerBusinessReferralValidation = z.object({
  body: z.object({
    referralCode: z.string({ message: "Referral code is required" }).trim().min(1, "Referral code cannot be empty"),
    businessId: z.string({ message: "Business ID is required" }).uuid({ message: "Invalid Business ID format" }),
  }),
});

export const creditMemberReferralValidation = z.object({
  params: z.object({
    id: z.string({ message: "Referral ID is required" }).uuid({ message: "Invalid Referral ID format" }),
  }),
});

export const getOwnerMemberReferralsValidation = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.string().optional(),
    referralCode: z.string().optional(),
    searchTerm: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.string().optional(),
  }),
});

export const ReferralValidations = {
  registerReferralValidation,
  registerBusinessReferralValidation,
  creditMemberReferralValidation,
  getOwnerMemberReferralsValidation,
};
