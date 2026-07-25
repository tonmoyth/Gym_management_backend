import { redis } from '../config/redis';

/**
 * Push a job into a Redis list acting as a queue.
 * @param queueName The name of the redis list.
 * @param payload The data to be processed by the worker.
 */
export const pushJob = async (queueName: string, payload: any) => {
    try {
        const jobData = JSON.stringify(payload);
        await redis.lpush(queueName, jobData);
    } catch (error: any) {
        // We catch the error but do not throw to ensure the main API thread doesn't crash on queue failures
        console.error(`❌ Failed to push job to queue ${queueName}:`, error.message);
    }
};
