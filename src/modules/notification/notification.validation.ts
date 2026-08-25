import { z } from 'zod';

const getMyNotificationsValidation = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    type: z.string().optional(),
    isRead: z.string().optional(),
    searchTerm: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.string().optional(),
  }),
});

const markNotificationAsReadValidation = z.object({
  params: z.object({
    id: z.string({
      message: 'Notification ID is required',
    }).uuid('Invalid notification ID format'),
  }),
});

export const NotificationValidations = {
  getMyNotificationsValidation,
  markNotificationAsReadValidation,
};
