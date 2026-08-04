import { prisma } from '../lib/prisma';
import { NotificationType } from '../generated/prisma/client';

const createNotification = async (
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    metadata?: any
) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                body,
                type,
                metadata: metadata ? metadata : undefined,
            },
        });
        return notification;
    } catch (error: any) {
        console.error('❌ Failed to create notification:', error.message);
        throw error;
    }
};

const createBulkNotifications = async (
    userIds: string[],
    title: string,
    body: string,
    type: NotificationType,
    metadata?: any
) => {
    if (!userIds.length) return;
    try {
        const data = userIds.map((userId) => ({
            userId,
            title,
            body,
            type,
            metadata: metadata ? metadata : undefined,
        }));
        await prisma.notification.createMany({
            data,
            skipDuplicates: true,
        });
    } catch (error: any) {
        console.error('❌ Failed to create bulk notifications:', error.message);
        throw error;
    }
};

export const NotificationService = {
    createNotification,
    createBulkNotifications,
};
