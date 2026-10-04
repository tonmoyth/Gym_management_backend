import { z } from 'zod';

const createAnnouncementValidation = z.object({
  body: z.object({
    title: z.string({ message: 'Title is required' }).min(3, { message: 'Title must be at least 3 characters' }),
    body: z.string({ message: 'Announcement body/content is required' }).min(5, { message: 'Body must be at least 5 characters' }),
    targetRole: z.enum(['ALL', 'BUSINESS_OWNER', 'TRAINER', 'MEMBER']).optional(),
  }),
});

export const SystemAnnouncementValidations = {
  createAnnouncementValidation,
};
