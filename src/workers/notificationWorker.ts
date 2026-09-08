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
        } else if (jobData.eventType === 'BUSINESS_APPROVED') {
            await processBusinessApproved(jobData);
        } else if (jobData.eventType === 'BUSINESS_REJECTED') {
            await processBusinessRejected(jobData);
        } else if (jobData.eventType === 'BUSINESS_SUSPENDED') {
            await processBusinessSuspended(jobData);
        } else if (jobData.eventType === 'ACCOUNT_SUSPENDED') {
            await processAccountSuspended(jobData);
        } else if (jobData.eventType === 'ACCOUNT_ACTIVATED') {
            await processAccountActivated(jobData);
        } else if (jobData.eventType === 'CERTIFICATION_VERIFIED') {
            await processCertificationVerified(jobData);
        } else if (jobData.eventType === 'CERTIFICATION_REJECTED') {
            await processCertificationRejected(jobData);
        } else if (jobData.eventType === 'SUBSCRIPTION_STATUS_UPDATED') {
            await processSubscriptionStatusUpdated(jobData);
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

const processBusinessApproved = async (data: any) => {
    const { ownerId, ownerEmail, ownerName, businessId, businessName } = data;

    // In-app Notification
    if (ownerId) {
        try {
            await NotificationService.createNotification(
                ownerId,
                'Business Approved 🎉',
                `Congratulations! Your business "${businessName}" has been approved by the platform administrator.`,
                NotificationType.SYSTEM,
                { businessId, status: 'ACTIVE' }
            );
            console.log(`✅ In-app notification created for business approval: ${businessId}`);
        } catch (error: any) {
            console.error('❌ Failed to create in-app notification for business approval:', error.message);
        }
    }

    // Email
    if (ownerEmail) {
        try {
            await MailService.sendBusinessApprovedEmail(ownerName, ownerEmail, businessName);
        } catch (error: any) {
            console.error('❌ Failed to send business approval email:', error.message);
        }
    }
};

const processBusinessRejected = async (data: any) => {
    const { ownerId, ownerEmail, ownerName, businessId, businessName, reason } = data;

    // In-app Notification
    if (ownerId) {
        try {
            await NotificationService.createNotification(
                ownerId,
                'Business Application Rejected',
                `Your registration for "${businessName}" was not approved.${reason ? ` Reason: ${reason}` : ''}`,
                NotificationType.SYSTEM,
                { businessId, status: 'REJECTED', reason }
            );
            console.log(`✅ In-app notification created for business rejection: ${businessId}`);
        } catch (error: any) {
            console.error('❌ Failed to create in-app notification for business rejection:', error.message);
        }
    }

    // Email
    if (ownerEmail) {
        try {
            await MailService.sendBusinessRejectedEmail(ownerName, ownerEmail, businessName, reason);
        } catch (error: any) {
            console.error('❌ Failed to send business rejection email:', error.message);
        }
    }
};

const processBusinessSuspended = async (data: any) => {
    const { ownerId, ownerEmail, ownerName, businessId, businessName, reason } = data;

    // In-app Notification
    if (ownerId) {
        try {
            await NotificationService.createNotification(
                ownerId,
                'Business Suspended ⚠️',
                `Your business "${businessName}" has been suspended by the platform administrator.${reason ? ` Reason: ${reason}` : ''}`,
                NotificationType.SYSTEM,
                { businessId, status: 'SUSPENDED', reason }
            );
            console.log(`✅ In-app notification created for business suspension: ${businessId}`);
        } catch (error: any) {
            console.error('❌ Failed to create in-app notification for business suspension:', error.message);
        }
    }

    // Email
    if (ownerEmail) {
        try {
            await MailService.sendBusinessSuspendedEmail(ownerName, ownerEmail, businessName, reason);
        } catch (error: any) {
            console.error('❌ Failed to send business suspension email:', error.message);
        }
    }
};

const processAccountSuspended = async (data: any) => {
    const { userId, userEmail, userName, role } = data;

    // In-app Notification
    if (userId) {
        try {
            await NotificationService.createNotification(
                userId,
                'Account Suspended ⚠️',
                `Your ${role ? role.toLowerCase() : ''} account has been suspended by the platform administrator. Access to protected features is blocked.`,
                NotificationType.SYSTEM,
                { userId, role, status: 'SUSPENDED' }
            );
            console.log(`✅ In-app notification created for account suspension: ${userId}`);
        } catch (error: any) {
            console.error('❌ Failed to create in-app notification for account suspension:', error.message);
        }
    }

    // Email
    if (userEmail) {
        try {
            await MailService.sendAccountSuspendedEmail(userName, userEmail, role);
        } catch (error: any) {
            console.error('❌ Failed to send account suspension email:', error.message);
        }
    }
};

const processAccountActivated = async (data: any) => {
    const { userId, userEmail, userName, role } = data;

    // In-app Notification
    if (userId) {
        try {
            await NotificationService.createNotification(
                userId,
                'Account Activated 🎉',
                `Your ${role ? role.toLowerCase() : ''} account has been activated! You now have full access to all platform features.`,
                NotificationType.SYSTEM,
                { userId, role, status: 'ACTIVE' }
            );
            console.log(`✅ In-app notification created for account activation: ${userId}`);
        } catch (error: any) {
            console.error('❌ Failed to create in-app notification for account activation:', error.message);
        }
    }

    // Email
    if (userEmail) {
        try {
            await MailService.sendAccountActivatedEmail(userName, userEmail, role);
        } catch (error: any) {
            console.error('❌ Failed to send account activation email:', error.message);
        }
    }
};

const processCertificationVerified = async (data: any) => {
    const { trainerUserId, trainerEmail, trainerName, certificationId, certificationTitle } = data;

    // In-app Notification
    if (trainerUserId) {
        try {
            await NotificationService.createNotification(
                trainerUserId,
                'Certification Verified 🎉',
                'Your trainer certification has been verified successfully. Your verified badge is now active.',
                NotificationType.SYSTEM,
                { certificationId, status: 'VERIFIED' }
            );
            console.log(`✅ In-app notification created for certification verification: ${certificationId}`);
        } catch (error: any) {
            console.error('❌ Failed to create in-app notification for certification verification:', error.message);
        }
    }

    // Email
    if (trainerEmail) {
        try {
            await MailService.sendCertificationVerifiedEmail(trainerName, trainerEmail, certificationTitle);
        } catch (error: any) {
            console.error('❌ Failed to send certification verification email:', error.message);
        }
    }
};

const processCertificationRejected = async (data: any) => {
    const { trainerUserId, trainerEmail, trainerName, certificationId, certificationTitle, reason } = data;

    // In-app Notification
    if (trainerUserId) {
        try {
            await NotificationService.createNotification(
                trainerUserId,
                'Certification Rejected',
                `Your trainer certification was rejected.${reason ? ` Reason: ${reason}` : ''}`,
                NotificationType.SYSTEM,
                { certificationId, status: 'REJECTED', reason }
            );
            console.log(`✅ In-app notification created for certification rejection: ${certificationId}`);
        } catch (error: any) {
            console.error('❌ Failed to create in-app notification for certification rejection:', error.message);
        }
    }

    // Email
    if (trainerEmail) {
        try {
            await MailService.sendCertificationRejectedEmail(trainerName, trainerEmail, certificationTitle, reason);
        } catch (error: any) {
            console.error('❌ Failed to send certification rejection email:', error.message);
        }
    }
};

const processSubscriptionStatusUpdated = async (data: any) => {
    const {
        ownerId,
        ownerEmail,
        ownerName,
        businessId,
        businessName,
        previousStatus,
        newStatus,
        nextBillingDate,
    } = data;

    let title = 'Gym Subscription Updated';
    let body = `Your gym subscription for "${businessName}" status has been updated to ${newStatus}.`;

    if (newStatus === 'ACTIVE') {
        title = 'Subscription Active 🎉';
        body = 'Your gym subscription is now active.';
    } else if (newStatus === 'INACTIVE') {
        title = 'Subscription Inactive ⚠️';
        body = 'Your gym subscription has been marked inactive.';
    } else if (newStatus === 'OVERDUE') {
        title = 'Subscription Payment Overdue ⚠️';
        body = 'Your gym subscription payment is overdue.';
    }

    // In-app Notification
    if (ownerId) {
        try {
            await NotificationService.createNotification(
                ownerId,
                title,
                body,
                NotificationType.SYSTEM,
                { businessId, previousStatus, status: newStatus }
            );
            console.log(`✅ In-app notification created for subscription status update: ${businessId}`);
        } catch (error: any) {
            console.error('❌ Failed to create in-app notification for subscription status update:', error.message);
        }
    }

    // Email
    if (ownerEmail) {
        try {
            await MailService.sendSubscriptionStatusUpdatedEmail(
                ownerName,
                ownerEmail,
                businessName,
                newStatus,
                nextBillingDate
            );
        } catch (error: any) {
            console.error('❌ Failed to send subscription status email:', error.message);
        }
    }
};
