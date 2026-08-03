import { redis } from '../config/redis';
import { MailService } from '../utils/mail.service';
import { NotificationService } from '../utils/notification.service';
import { NotificationType } from '../generated/prisma/client';

const QUEUE_NAME = 'job_application_queue';
const MAX_RETRIES = 3;

export const startApplicationWorker = () => {
    console.log(`✅ Starting Application Worker listening on ${QUEUE_NAME}...`);
    
    // Start background processing loop without blocking the caller
    processQueue();
};

const processQueue = async () => {
    while (true) {
        try {
            // brpop blocks until an item is available in the queue. 
            // The 0 means it will wait indefinitely.
            const result = await redis.brpop(QUEUE_NAME, 0);
            
            if (result) {
                const [_, jobDataStr] = result;
                const jobData = JSON.parse(jobDataStr);
                
                // Process the job asynchronously so we can quickly get the next job if needed,
                // but usually await is fine here if order matters. We will await to handle retries properly.
                await handleJobWithRetry(jobData);
            }
        } catch (error: any) {
            console.error('❌ Application Worker Error:', error.message);
            // Small delay to prevent tight loop in case of Redis connection drops
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
};

const handleJobWithRetry = async (jobData: any, attempt: number = 1) => {
    try {
        if (jobData.eventType === 'REJECTED') {
            await processApplicationRejected(jobData);
        } else if (jobData.eventType === 'TRAINER_REMOVED_FROM_BUSINESS') {
            await processTrainerRemoved(jobData);
        } else {
            // Default to approved for backward compatibility
            await processApplicationApproved(jobData);
        }
    } catch (error: any) {
        if (attempt <= MAX_RETRIES) {
            const backoff = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.warn(`⚠️ Job processing failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${backoff}ms...`);
            await new Promise((resolve) => setTimeout(resolve, backoff));
            await handleJobWithRetry(jobData, attempt + 1);
        } else {
            console.error(`❌ Job failed after ${MAX_RETRIES} attempts. Discarding job for applicationId:`, jobData.applicationId);
        }
    }
};

const processApplicationApproved = async (data: any) => {
    const {
        applicationId,
        trainerUserId, // Important: Notification needs User ID, not TrainerProfile ID
        trainerName,
        trainerEmail,
        businessId,
        businessName,
        jobPostId,
        jobPostTitle,
        trainerBusinessId
    } = data;

    // 1. Idempotency Check
    const idempotencyKey = `processed:job_application:${applicationId}`;
    const alreadyProcessed = await redis.setnx(idempotencyKey, '1');
    if (alreadyProcessed === 0) {
        console.log(`⏭️ Application ${applicationId} already processed. Skipping.`);
        return;
    }
    
    // Set expiration for idempotency key (e.g., 30 days) to prevent infinite Redis memory growth
    await redis.expire(idempotencyKey, 30 * 24 * 60 * 60);

    // 2. Create Notification
    try {
        await NotificationService.createNotification(
            trainerUserId,
            'Application Approved 🎉',
            `Congratulations!\n\nYour trainer application has been approved by ${businessName}.\n\nYou can now access this business from your Trainer Dashboard.`,
            NotificationType.JOB_APPLICATION,
            {
                businessId,
                businessName,
                jobPostId,
                jobPostTitle,
                trainerBusinessId,
                applicationId
            }
        );
    } catch (error: any) {
        console.error('❌ Notification failed for application:', applicationId, error.message);
        // Continue processing to attempt email even if notification fails
    }

    // 3. Send Email
    try {
        await MailService.sendApplicationApprovedEmail(
            trainerName,
            businessName,
            jobPostTitle,
            trainerEmail
        );
    } catch (error: any) {
        console.error('❌ Email failed for application:', applicationId, error.message);
        // In this implementation, we throw to trigger retry if email fails.
        // If we want partial successes, we might handle this differently, but throwing guarantees retry.
        throw error;
    }

    console.log(`✅ Successfully processed background tasks for application ${applicationId}`);
};

const processApplicationRejected = async (data: any) => {
    const {
        applicationId,
        trainerUserId,
        trainerName,
        trainerEmail,
        businessId,
        businessName,
        jobPostId,
        jobPostTitle
    } = data;

    // 1. Idempotency Check
    const idempotencyKey = `processed:job_application:${applicationId}:rejected`;
    const alreadyProcessed = await redis.setnx(idempotencyKey, '1');
    if (alreadyProcessed === 0) {
        console.log(`⏭️ Application Rejection ${applicationId} already processed. Skipping.`);
        return;
    }
    
    await redis.expire(idempotencyKey, 30 * 24 * 60 * 60);

    // 2. Create Notification
    try {
        await NotificationService.createNotification(
            trainerUserId,
            'Application Update',
            `Your application for the Trainer position at ${businessName} was not selected.\n\nThank you for your interest. We encourage you to apply for other opportunities on our platform.`,
            NotificationType.JOB_APPLICATION,
            {
                businessId,
                businessName,
                jobPostId,
                jobPostTitle,
                applicationId
            }
        );
    } catch (error: any) {
        console.error('❌ Notification failed for rejected application:', applicationId, error.message);
    }

    // 3. Send Email
    try {
        await MailService.sendApplicationRejectedEmail(
            trainerName,
            businessName,
            jobPostTitle,
            trainerEmail
        );
    } catch (error: any) {
        console.error('❌ Email failed for rejected application:', applicationId, error.message);
        throw error;
    }

    console.log(`✅ Successfully processed background tasks for rejected application ${applicationId}`);
};

const processTrainerRemoved = async (data: any) => {
    const {
        trainerId,
        trainerUserId,
        businessId,
        businessName,
        trainerName,
        trainerEmail,
    } = data;

    // 1. Create Notification
    try {
        await NotificationService.createNotification(
            trainerUserId,
            'Removed From Business',
            'You have been removed from a business by the business owner.',
            NotificationType.SYSTEM,
            { businessId, trainerId }
        );
    } catch (error: any) {
        console.error('❌ Notification failed for trainer removal:', error.message);
    }

    // 2. Send Email
    try {
        await MailService.sendTrainerRemovedEmail(
            trainerName,
            businessName,
            trainerEmail
        );
    } catch (error: any) {
        console.error('❌ Email failed for trainer removal:', error.message);
        throw error;
    }

    console.log(`✅ Successfully processed background tasks for trainer removal from business ${businessId}`);
};
