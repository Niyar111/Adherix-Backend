import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Task 4: Redis Infrastructure Setup
 * Connects to Upstash Cloud Redis using the URL in your .env file.
 */
export const redisConnection = new IORedis(process.env.REDIS_URL, {
    // Required settings for BullMQ compatibility
    maxRetriesPerRequest: null,
});

// Initialize the main queue for adherence tasks (Reaper & Reminders)
export const adherenceQueue = new Queue('adherence-tasks', {
    connection: redisConnection
});

redisConnection.on('connect', () => {
    console.log('Connected to Upstash Redis (Mumbai Instance)');
});

redisConnection.on('error', (err) => {
    console.error(' Redis Connection Error:', err.message);
});