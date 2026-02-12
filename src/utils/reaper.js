import Medication from '../models/medModel.js';
import Log from '../models/logModel.js';
import Connection from '../models/connectionModel.js';
import { adherenceQueue } from '../config/redis.js';
import { DateTime } from 'luxon';

/**
 * BACKGROUND REAPER WORKER
 * @param {Object} io - Pass the Socket.io instance from the worker/server
 */
export const runAutomatedReaper = async (io = null) => { // Added io parameter
    let missedCount = 0;

    try {
        console.log('🤖 Reaper: Starting scan for ghost doses...');

        const meds = await Medication.find({
            isDeleted: false,
            medType: 'scheduled'
        }).populate('user');

        for (const med of meds) {
            if (!med.user) continue;

            const userTz = med.user.timezone || 'UTC';
            const now = DateTime.now().setZone(userTz);

            for (const scheduledTime of med.timings) {
                const [hour, minute] = scheduledTime.split(':');

                const scheduledDateTime = now.set({
                    hour: Number(hour),
                    minute: Number(minute),
                    second: 0,
                    millisecond: 0
                });

                const missedThreshold = scheduledDateTime.plus({ hours: 2 });
                if (now <= missedThreshold) continue;

                const startOfDay = now.startOf('day').toJSDate();
                const endOfDay = now.endOf('day').toJSDate();

                const existingLog = await Log.findOne({
                     medication: med._id,
                     scheduledTime,
                     createdAt: { $gte: startOfDay, $lte: endOfDay }
                });

                if (existingLog) continue;

                // 1️⃣ Create missed log
                const newLog = await Log.create({
                    user: med.user._id,
                    medication: med._id,
                    scheduledTime,
                    status: 'missed',
                    adherenceStatus: 'missed',
                    takenAt: now.toJSDate()
                });

                missedCount++;

                // 2️⃣ Find active guardians
                const activeConnections = await Connection.find({
                    patientId: med.user._id,
                    status: 'active'
                }).populate('guardianId', 'email name');

                // 3️⃣ Queue alerts & Emit Real-Time Socket Events
                for (const conn of activeConnections) {
                    if (!conn.guardianId?.email) continue;

                    // A. Email Alert via Redis
                    await adherenceQueue.add('guardian-alert', {
                        guardianEmail: conn.guardianId.email,
                        patientName: med.user.name || 'Your Patient',
                        medName: med.name,
                        missedTime: scheduledTime
                    }, { priority: 1, removeOnComplete: true });

                    // B. LIVE PULSE: Notify Guardian Instantly
                    if (io) {
                        const guardianId = conn.guardianId._id.toString();
                        io.to(guardianId).emit('emergency_alert', {
                            type: 'MISSED_DOSE',
                            patientName: med.user.name,
                            medName: med.name,
                            time: scheduledTime,
                            severity: 'critical'
                        });
                        console.log(`📡 Real-time alert emitted to Guardian Room: ${guardianId}`);
                    }
                }
            }
        }

        console.log(`💀 Reaper Finished. Missed doses processed: ${missedCount}`);
        return missedCount;

    } catch (error) {
        console.error('❌ Reaper Fatal Error:', error);
        throw error;
    }
};