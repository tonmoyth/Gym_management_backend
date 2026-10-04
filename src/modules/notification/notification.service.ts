import { prisma } from '../../lib/prisma';
import { QueryBuilder } from '../../utils/queryBuilder';
import { notificationFilterableFields, notificationSearchableFields } from './notification.constant';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { auditLogger } from '../../utils/auditLogger';

const getMyNotifications = async (userId: string, query: Record<string, unknown>) => {
  const queryConfig = {
    searchableFields: notificationSearchableFields,
    filterableFields: notificationFilterableFields,
  };

  // Strip any client-supplied userId to prevent ownership spoofing
  const queryParams = { ...query };
  delete queryParams.userId;

  const notificationQuery = new QueryBuilder(prisma.notification, queryParams as any, queryConfig)
    .where({ userId } as Record<string, unknown>)
    .search()
    .filter()
    .sort()
    .paginate();

  const result = await notificationQuery.execute();
  return result;
};

const markNotificationAsRead = async (
  userId: string,
  notificationId: string,
  reqMeta?: { ipAddress?: string; userAgent?: string }
) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, 'Notification not found');
  }

  // Strict ownership check: Must belong to authenticated user
  if (notification.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Forbidden: You do not have permission to update this notification'
    );
  }

  // Idempotent handling: if already read, return directly without failing or writing
  if (notification.isRead) {
    return {
      id: notification.id,
      isRead: true,
      title: notification.title,
      type: notification.type,
      createdAt: notification.createdAt,
    };
  }

  const updatedNotification = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
    select: {
      id: true,
      isRead: true,
      title: true,
      type: true,
      createdAt: true,
    },
  });

  await auditLogger.record({
    actorId: userId,
    action: 'NOTIFICATION_MARKED_READ',
    resource: 'NOTIFICATION',
    resourceId: notificationId,
    details: `User marked notification ${notificationId} as read`,
    ipAddress: reqMeta?.ipAddress,
    userAgent: reqMeta?.userAgent,
  });

  return updatedNotification;
};

const markAllNotificationsAsRead = async (
  userId: string,
  reqMeta?: { ipAddress?: string; userAgent?: string }
) => {
  const updateResult = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  await auditLogger.record({
    actorId: userId,
    action: 'NOTIFICATIONS_READ_ALL',
    resource: 'NOTIFICATION',
    details: `User marked all unread notifications as read (${updateResult.count} updated)`,
    metadata: {
      updatedCount: updateResult.count,
    },
    ipAddress: reqMeta?.ipAddress,
    userAgent: reqMeta?.userAgent,
  });

  return {
    updatedCount: updateResult.count,
  };
};

export const NotificationService = {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
