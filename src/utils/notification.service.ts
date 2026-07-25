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

export const NotificationService = {
    createNotification,
};
