import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { runAutomatedReaper } from '../utils/reaper.js';

/**
 * Task 4, 5 & 9: Background Worker with Live Pulse support
 */
const adherenceWorker = (io) => new Worker('adherence-tasks', async (job) => { // 1. Wrap in a function to accept 'io'
    
    // Task 1: The Hourly Reaper logic
    if (job.name === 'run-reaper') {
        console.log('🤖 Reaper Worker: Scanning for missed doses...');
        // 2. Pass the io instance to the reaper for real-time alerts
        await runAutomatedReaper(io); 
    }

    // Task 5: The Smart Reminder for Patients
    if (job.name === 'send-reminder') {
        const { medName, scheduledTime, userId } = job.data;
        console.log(`⏰ REMINDER: User ${userId} needs to take ${medName} at ${scheduledTime}`);
        
        // Push notification logic for FCM goes here
    }

    // Task 9: Real-time Guardian Alerts for Missed Doses
    if (job.name === 'guardian-alert') {
        const { guardianEmail, patientName, medName, missedTime } = job.data;
        
        console.log('---------------------------------------------------------');
        console.log(`🚨 GUARDIAN ALERT LOGGED!`);
        console.log(`Guardian: ${guardianEmail}`);
        console.log(`Message: ${patientName} missed ${medName} at ${missedTime}`);
        console.log('---------------------------------------------------------');

        // Optional: You could also emit a direct socket event here if needed
    }

}, { 
    connection: redisConnection,
    concurrency: 5 
});

// Note: To use this, you will call it in server.js and pass 'io'
export default adherenceWorker;