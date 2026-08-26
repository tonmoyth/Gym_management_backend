import { redis } from '../config/redis';
import { prisma } from '../lib/prisma';
import { MailService } from '../utils/mail.service';
import { NotificationService } from '../utils/notification.service';
import { NotificationType } from '../generated/prisma/client';

const QUEUE_NAME = 'notification_queue';
const MAX_RETRIES = 3;

export const startNotificationWorker = () => {
    console.log(`✅ Starting Notification Worker listening on ${QUEUE_NAME}...`);
    processQueue();
};

const workerRedis = redis.duplicate();

const processQueue = async () => {
    while (true) {
        try {
            const result = await workerRedis.brpop(QUEUE_NAME, 0);
            
            if (result) {
                const [_, jobDataStr] = result;
                const jobData = JSON.parse(jobDataStr);
                
                await handleJobWithRetry(jobData);
            }
        } catch (error: any) {
            console.error('❌ Notification Worker Error:', error.message);
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
};

const handleJobWithRetry = async (jobData: any, attempt: number = 1) => {
    try {
        if (jobData.eventType === 'BUSINESS_ANNOUNCEMENT_CREATED') {
            await processAnnouncement(jobData);
        } else if (jobData.eventType === 'MEMBERSHIP_APPROVED') {
            await processMembershipApproved(jobData);
        } else if (jobData.eventType === 'MEMBERSHIP_REJECTED') {
            await processMembershipRejected(jobData);
        } else {
            // Unhandled event type, just log it for now
            console.log(`ℹ️ Notification Worker received unhandled event type: ${jobData.eventType}`);
        }
    } catch (error: any) {
        if (attempt <= MAX_RETRIES) {
            const backoff = Math.pow(2, attempt) * 1000;
            console.warn(`⚠️ Notification processing failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${backoff}ms...`);
            await new Promise((resolve) => setTimeout(resolve, backoff));
            await handleJobWithRetry(jobData, attempt + 1);
        } else {
            console.error(`❌ Job failed after ${MAX_RETRIES} attempts. Discarding job. EventType:`, jobData.eventType);
        }
    }
};

const processAnnouncement = async (data: any) => {
    const {
        announcementId,
        businessId,
        businessName,
        title,
        body,
        targetAudience // "MEMBERS", "TRAINERS", "BOTH"
    } = data;

    console.log(`Processing announcement ${announcementId} for business ${businessId} with audience ${targetAudience}`);

    // Idempotency Check
    const idempotencyKey = `processed:announcement:${announcementId}`;
    const alreadyProcessed = await redis.setnx(idempotencyKey, '1');
    if (alreadyProcessed === 0) {
        console.log(`⏭️ Announcement ${announcementId} already processed. Skipping.`);
        return;
    }
    
    await redis.expire(idempotencyKey, 30 * 24 * 60 * 60);

    const targetUserIds = new Set<string>();
    const targetEmails = new Set<string>();

    if (targetAudience === 'MEMBERS' || targetAudience === 'BOTH') {
        const memberships = await prisma.membership.findMany({
            where: { businessId, status: 'ACTIVE' },
            include: { member: { include: { user: true } } }
        });

        memberships.forEach(m => {
            if (m.member.user) {
                targetUserIds.add(m.member.user.id);
                targetEmails.add(m.member.user.email);
            }
        });
    }

    if (targetAudience === 'TRAINERS' || targetAudience === 'BOTH') {
        const trainers = await prisma.trainerBusiness.findMany({
            where: { businessId },
            include: { trainer: { include: { user: true } } }
        });

        trainers.forEach(t => {
            if (t.trainer.user) {
                targetUserIds.add(t.trainer.user.id);
                targetEmails.add(t.trainer.user.email);
            }
        });
    }

    const userIdsArray = Array.from(targetUserIds);
    const emailsArray = Array.from(targetEmails);

    // Create Bulk Notifications
    if (userIdsArray.length > 0) {
        await NotificationService.createBulkNotifications(
            userIdsArray,
            title,
            body,
            NotificationType.ANNOUNCEMENT,
            { announcementId, businessId, targetAudience }
        );
        console.log(`✅ Bulk notifications created for ${userIdsArray.length} users`);
    } else {
        console.log(`ℹ️ No target users found to send notifications for announcement ${announcementId}`);
    }

    // Send Bulk Emails
    if (emailsArray.length > 0) {
        await MailService.sendBulkAnnouncementEmail(
            emailsArray,
            businessName,
            title,
            body
        );
    } else {
        console.log(`ℹ️ No target emails found to send emails for announcement ${announcementId}`);
    }
    
    console.log(`✅ Successfully processed announcement ${announcementId}`);
};

const processMembershipApproved = async (data: any) => {
    const {
        userId,
        userEmail,
        userName,
        membershipId,
        businessId,
        businessName,
        planName,
        startDate,
        endDate
    } = data;

    const idempotencyKey = `processed:membership_approved:${membershipId}`;
    const alreadyProcessed = await redis.setnx(idempotencyKey, '1');
    if (alreadyProcessed === 0) {
        console.log(`⏭️ Membership approval ${membershipId} already processed. Skipping.`);
        return;
    }
    
    await redis.expire(idempotencyKey, 30 * 24 * 60 * 60);

    // In-app Notification
    await NotificationService.createNotification(
        userId,
        'Membership Approved',
        `Your ${planName} membership booking at ${businessName} has been approved.`,
        NotificationType.BOOKING,
        { membershipId, businessId, planId: planName, status: 'ACTIVE' }
    );

    // Email
    if (userEmail) {
        await MailService.sendMembershipApprovedEmail(
            userName,
            userEmail,
            businessName,
            planName,
            startDate,
            endDate
        );
    }
};

const processMembershipRejected = async (data: any) => {
    const {
        userId,
        userEmail,
        userName,
        membershipId,
        businessId,
        businessName,
        planName,
        refundStatus
    } = data;

    const idempotencyKey = `processed:membership_rejected:${membershipId}`;
    const alreadyProcessed = await redis.setnx(idempotencyKey, '1');
    if (alreadyProcessed === 0) {
        console.log(`⏭️ Membership rejection ${membershipId} already processed. Skipping.`);
        return;
    }
    
    await redis.expire(idempotencyKey, 30 * 24 * 60 * 60);

    // In-app Notification
    await NotificationService.createNotification(
        userId,
        'Membership Booking Rejected',
        `Your ${planName} membership booking at ${businessName} has been rejected by the business.`,
        NotificationType.BOOKING,
        { membershipId, businessId, planId: planName, status: 'REJECTED', refundStatus }
    );

    // Email
    if (userEmail) {
        await MailService.sendMembershipRejectedEmail(
            userName,
            userEmail,
            businessName,
            planName,
            refundStatus
        );
    }
};
