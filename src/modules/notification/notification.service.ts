import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { QueryBuilder } from '../../utils/queryBuilder';
import { notificationFilterableFields, notificationSearchableFields } from './notification.constant';
import AppError from '../../errors/AppError';

const getMyNotifications = async (userId: string, query: Record<string, unknown>) => {
  const queryConfig = {
    searchableFields: notificationSearchableFields,
    filterableFields: notificationFilterableFields,
  };

  const baseCondition = {
    userId,
  };

  const notificationQuery = new QueryBuilder(prisma.notification, query as any, queryConfig)
    .search()
    .filter()
    .sort()
    .paginate()
    .where(baseCondition as Record<string, unknown>);

  const result = await notificationQuery.execute();
  return result;
};

const markNotificationAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId,
      userId: userId, // Ensure ownership
    },
  });

  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }

  const updatedNotification = await prisma.notification.update({
    where: {
      id: notificationId,
      userId: userId, // Extra safety in update
    },
    data: {
      isRead: true,
    },
    select: {
      id: true,
      isRead: true,
    },
  });

  return updatedNotification;
};

export const NotificationService = {
  getMyNotifications,
  markNotificationAsRead,
};
