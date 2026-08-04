import { z } from "zod";

const createAnnouncementValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }),
  }),
  body: z.object({
    title: z.string({ message: "Title is required." }),
    content: z.string({ message: "Content is required." }),
    targetAudience: z.enum(["MEMBERS", "TRAINERS", "BOTH"], {
      message: "Target audience must be MEMBERS, TRAINERS, or BOTH.",
    }),
  }),
});

const getAnnouncementsValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }),
  }),
  query: z.object({
    targetAudience: z.enum(["MEMBERS", "TRAINERS", "BOTH"]).optional(),
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
