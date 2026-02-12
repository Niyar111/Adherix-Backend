import Log from '../models/logModel.js';
import { DateTime } from 'luxon';
import mongoose from 'mongoose';

/**
 * @desc    Calculates consecutive days of 100% medical compliance
 * @task    Phase 5 - Task 1: Clinical Reliability
 */
export const calculateReliabilityIndex = async (userId) => {
    let dayCount = 0;
    let checkingDate = DateTime.now().startOf('day');

    while (true) {
        const start = checkingDate.toJSDate();
        const end = checkingDate.endOf('day').toJSDate();

        // Check for logs on the specific day
        const dailyLogs = await Log.find({
            user: userId,
            takenAt: { $gte: start, $lte: end }
        });

        // Break if no logs exist (data gap) or if any dose was missed
        if (dailyLogs.length === 0) break;

        const hasMissed = dailyLogs.some(log => log.status === 'missed');

        if (!hasMissed) {
            dayCount++;
            checkingDate = checkingDate.minus({ days: 1 });
        } else {
            break;
        }

        if (dayCount >= 90) break; // Logical historical limit
    }

    return dayCount;
};

/**
 * @desc    Generates daily adherence percentages for the last 30 days
 * @task    Phase 5 - Task 2: Compliance Heatmap
 */
export const getComplianceHeatmap = async (userId) => {
    const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).startOf('day').toJSDate();

    // High-performance aggregation to group logs by date
    const stats = await Log.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId),
                takenAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$takenAt" } },
                total: { $sum: 1 },
                taken: { $sum: { $cond: [{ $eq: ["$status", "taken"] }, 1, 0] } }
            }
        },
        {
            $project: {
                date: "$_id",
                percentage: { 
                    $round: [
                        { $multiply: [
                            { $divide: [
                                { $cond: [{ $eq: ["$total", 0] }, 0, "$taken"] }, 
                                { $cond: [{ $eq: ["$total", 0] }, 1, "$total"] }
                            ] }, 
                            100
                        ] }, 
                        0
                    ] 
                },
                _id: 0
            }
        },
        { $sort: { date: 1 } }
    ]);

    return stats;
};

/**
 * @desc    Identifies behavioral patterns (missed dose hotspots)
 * @task    Phase 3: Pattern Analysis
 */
export const getBehavioralPatterns = async (userId) => {
    const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toJSDate();

    const patterns = await Log.aggregate([
        { 
            $match: { 
                user: new mongoose.Types.ObjectId(userId), 
                status: 'missed', 
                takenAt: { $gte: thirtyDaysAgo } 
            } 
        },
        {
            $group: {
                _id: "$scheduledTime",
                missedCount: { $sum: 1 }
            }
        },
        { $sort: { missedCount: -1 } }
    ]);

    return patterns;
};
/**
 * @desc    Predicts when medication stock will be exhausted
 * @task    Phase 5 - Task 3: Inventory Logistics
 */
export const getInventoryRunway = async (userId) => {
    const meds = await Medication.find({ 
        user: userId, 
        isDeleted: false,
        isActive: true 
    });

    const inventoryReports = meds.map(med => {
        const dailyDoses = med.timings.length;
        // Calculation: current / daily frequency
        const daysRemaining = dailyDoses > 0 
            ? Math.floor(med.currentInventory / dailyDoses) 
            : 0;

        return {
            medicationId: med._id,
            name: med.name,
            currentStock: med.currentInventory,
            daysRemaining,
            status: daysRemaining <= 3 ? 'Critical' : daysRemaining <= 7 ? 'Low' : 'Healthy'
        };
    });

    return inventoryReports;
};
/**
 * @desc    Analyzes missed doses to find "Temporal Risk" windows
 * @task    Phase 5 - Task 4: Behavioral Risk
 */
export const getTemporalRiskAnalysis = async (userId) => {
    const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toJSDate();

    const stats = await Log.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId),
                status: 'missed',
                takenAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $project: {
                // Extract the hour from the scheduledTime string (e.g., "08:00" -> 8)
                hour: { $toInt: { $arrayElemAt: [{ $split: ["$scheduledTime", ":"] }, 0] } }
            }
        },
        {
            $project: {
                period: {
                    $cond: [
                        { $and: [{ $gte: ["$hour", 6] }, { $lt: ["$hour", 12] }] }, "Morning",
                        { $cond: [
                            { $and: [{ $gte: ["$hour", 12] }, { $lt: ["$hour", 18] }] }, "Afternoon",
                            { $cond: [
                                { $and: [{ $gte: ["$hour", 18] }, { $lt: ["$hour", 22] }] }, "Evening", "Night"
                            ]}
                        ]}
                    ]
                }
            }
        },
        {
            $group: {
                _id: "$period",
                missedCount: { $sum: 1 }
            }
        }
    ]);

    return stats;
};
/**
 * @desc    Finds the next upcoming dose for the user
 * @task    Phase 5 - Task 5: Contextual Awareness
 */
export const getNextDoseDiscovery = async (userId) => {
    const userMeds = await Medication.find({ user: userId, isDeleted: false, isActive: true });
    const now = DateTime.now(); // We will use the user's TZ in the controller
    
    let upcomingDoses = [];

    userMeds.forEach(med => {
        med.timings.forEach(time => {
            const [hour, minute] = time.split(':');
            let scheduled = now.set({ hour: parseInt(hour), minute: parseInt(minute), second: 0, millisecond: 0 });

            // If the time has already passed today, check for tomorrow
            if (scheduled < now) {
                scheduled = scheduled.plus({ days: 1 });
            }

            upcomingDoses.push({
                medName: med.name,
                medId: med._id,
                scheduledTime: time,
                fullTimestamp: scheduled,
                diffInMinutes: scheduled.diff(now, 'minutes').minutes
            });
        });
    });

    // Sort by whichever dose is happening soonest
    upcomingDoses.sort((a, b) => a.diffInMinutes - b.diffInMinutes);

    return upcomingDoses[0] || null; // Return the single most urgent dose
};