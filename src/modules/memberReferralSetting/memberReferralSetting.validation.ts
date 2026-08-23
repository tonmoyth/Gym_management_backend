import { z } from "zod";

const setReferralSettingsValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
  body: z.object({
    rewardType: z.enum(["FIXED_AMOUNT", "PERCENTAGE"], {
      message: "Reward type must be FIXED_AMOUNT or PERCENTAGE.",
    }),
    rewardValue: z.number({ message: "Reward value is required." }).positive({ message: "Reward value must be greater than 0." }),
  }).refine((data) => {
    if (data.rewardType === "PERCENTAGE" && data.rewardValue > 100) {
      return false;
    }
    return true;
  }, {
    message: "Percentage reward value cannot exceed 100.",
    path: ["rewardValue"],
  }),
});

const getReferralSettingsValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
});

export const MemberReferralSettingValidations = {
  setReferralSettingsValidation,
  getReferralSettingsValidation,
};
