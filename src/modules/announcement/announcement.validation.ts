import { z } from "zod";

const createAnnouncementValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }),
  }),
  body: z
    .object({
      title: z.string({ message: "Title is required." }),
      content: z.string().optional(),
      body: z.string().optional(),
      targetAudience: z.enum(["MEMBERS", "TRAINERS", "BOTH"]).optional(),
      audience: z.enum(["MEMBERS", "TRAINERS", "BOTH"]).optional(),
    })
    .refine((data) => Boolean(data.content || data.body), {
      message: "Announcement content or message body is required.",
      path: ["content"],
    })
    .refine((data) => Boolean(data.targetAudience || data.audience), {
      message: "Target audience must be MEMBERS, TRAINERS, or BOTH.",
      path: ["targetAudience"],
    }),
});

const getAnnouncementsValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }),
  }),
  query: z.object({
    targetAudience: z.enum(["MEMBERS", "TRAINERS", "BOTH"]).optional(),
    audience: z.enum(["MEMBERS", "TRAINERS", "BOTH"]).optional(),
    createdAt: z.string().optional(),
    searchTerm: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const AnnouncementValidations = {
  createAnnouncementValidation,
  getAnnouncementsValidation,
};
