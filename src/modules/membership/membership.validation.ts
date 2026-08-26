import { z } from "zod";

const createMembershipSchema = z.object({
  body: z.object({
    planId: z.string().uuid({ message: "Invalid plan ID" }),
  }),
});

const upgradeMembershipSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Invalid membership ID" }),
  }),
  body: z.object({
    newPlanId: z.string().uuid({ message: "Invalid plan ID" }),
  }),
});

const cancelMembershipSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Invalid membership ID" }),
  }),
});

const approveMembershipSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Invalid membership ID" }),
  }),
});

const rejectMembershipSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: "Invalid membership ID" }),
  }),
  body: z.object({
    reason: z.string(),
  }),
});

export const membershipValidation = {
  createMembershipSchema,
  upgradeMembershipSchema,
  cancelMembershipSchema,
  approveMembershipSchema,
  rejectMembershipSchema,
};
