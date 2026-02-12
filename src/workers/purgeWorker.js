import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import Medication from '../models/medModel.js';
import { DateTime } from 'luxon';

/**
 * @desc Background worker to permanently delete old "Soft Deleted" records
 */
const purgeWorker = new Worker('purgeQueue', async (job) => {
    console.log('Starting Monthly Data Hygiene Purge...');

    // Calculate the cutoff date (30 days ago)
    const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toJSDate();

    try {
        // Find and permanently remove medications that were soft-deleted > 30 days ago
        const result = await Medication.deleteMany({
            isDeleted: true,
            deletedAt: { $lt: thirtyDaysAgo }
        });

        console.log(` Purge Complete. Removed ${result.deletedCount} ancient records.`);
        return result.deletedCount;
    } catch (error) {
        console.error(' Purge Worker Failed:', error);
        throw error;
    }
}, { connection: redisConnection });

export default purgeWorker;