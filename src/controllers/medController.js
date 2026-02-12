import mongoose from 'mongoose';
import Medication from '../models/medModel.js';
import Log from '../models/logModel.js';
import Event from '../models/eventModel.js'; 
import { recordEvent } from '../utils/eventLogger.js'; 
import { DateTime } from 'luxon';
import { adherenceQueue } from '../config/redis.js';

/**
 * @desc    Add a new medication + Schedule Redis Reminders
 * @route   POST /api/meds/add
 */
export const addMedication = async (req, res) => {
    try {
        const { name, dosage, frequency, timings, instructions, totalQuantity, medType } = req.body;
        const userTimezone = req.user.timezone || 'UTC';
        
        const medication = await Medication.create({
            user: req.user._id, 
            name,
            dosage,
            medType: medType || 'scheduled', 
            frequency,
            timings,
            instructions,
            totalQuantity,
            remainingQuantity: totalQuantity 
        });

        if (medication.medType === 'scheduled') {
            for (const time of timings) {
                const delay = calculateDelayInMs(time, userTimezone);
                
                await adherenceQueue.add('send-reminder', {
                    userId: req.user._id,
                    medName: name,
                    scheduledTime: time,
                    medId: medication._id
                }, {
                    delay: delay, 
                    removeOnComplete: true 
                });
            }
        }

        res.status(201).json({ status: 'success', data: medication });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Log a dose (Handles Adherence, Double-Dose Guard & Audit Events)
 * @task    1: Atomic Transactions
 * @task    2: Adherence Event Log
 */
export const logDose = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { medId, scheduledTime, status } = req.body; 
        const userTimezone = req.user.timezone || 'UTC';

        const tenMinutesAgo = DateTime.now().minus({ minutes: 10 }).toJSDate();
        const duplicateLog = await Log.findOne({
            user: req.user._id,
            medication: medId,
            scheduledTime,
            takenAt: { $gte: tenMinutesAgo },
            status: 'taken'
        }).session(session);

        if (duplicateLog && (status === 'taken' || !status)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ status: 'fail', message: 'Safety Alert: Logged recently.' });
        }

        const now = DateTime.now().setZone(userTimezone);
        let adherenceStatus = 'on-time';
        let delayMinutes = 0;

        if (scheduledTime && status !== 'missed') {
            const [hour, minute] = scheduledTime.split(':');
            const scheduled = now.set({ hour: parseInt(hour), minute: parseInt(minute), second: 0 });
            const diffInMinutes = now.diff(scheduled, 'minutes').minutes;
            
            if (diffInMinutes > 30) {
                adherenceStatus = 'late';
                delayMinutes = Math.floor(diffInMinutes);
            }
        }

        const logArray = await Log.create([{
            user: req.user._id,
            medication: medId,
            status: status || 'taken',
            scheduledTime,
            adherenceStatus: status === 'missed' ? 'missed' : adherenceStatus,
            delayMinutes,
            takenAt: now.toJSDate() 
        }], { session });

        if (status === 'taken' || !status) {
            const medication = await Medication.findOneAndUpdate(
                { _id: medId, user: req.user._id, isDeleted: false },
                { $inc: { remainingQuantity: -1 } },
                { session, new: true }
            );

            if (!medication) throw new Error('Medication not found or unavailable.');

            await recordEvent(
                req.user._id,
                medId,
                adherenceStatus === 'late' ? 'DOSE_LATE' : 'DOSE_TAKEN',
                { scheduledTime, delayMinutes },
                session
            );

            if (medication.remainingQuantity < 5) {
                await recordEvent(req.user._id, medId, 'INVENTORY_LOW', { stock: medication.remainingQuantity }, session);
            }
        } else if (status === 'missed') {
            await recordEvent(req.user._id, medId, 'DOSE_MISSED', { scheduledTime }, session);
        }

        await session.commitTransaction();
        session.endSession();
        res.status(201).json({ status: 'success', data: logArray[0] });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Update medication details
 */
export const updateMedication = async (req, res) => {
    try {
        const updatedMed = await Medication.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, isDeleted: false },
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedMed) return res.status(404).json({ message: 'Not found or already deleted' });
        res.status(200).json({ status: 'success', data: updatedMed });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get history with Pagination
 */
export const getMedHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const logs = await Log.find({ medication: req.params.medId, user: req.user._id })
            .sort('-takenAt')
            .skip(skip)
            .limit(limit);

        const total = await Log.countDocuments({ medication: req.params.medId, user: req.user._id });

        res.status(200).json({ status: 'success', totalLogs: total, data: logs });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get adherence report
 */
export const getAdherenceReport = async (req, res) => {
    try {
        const logs = await Log.find({ user: req.user._id });
        if (logs.length === 0) return res.status(200).json({ status: 'success', adherencePercentage: "0%" });

        const onTimeCount = logs.filter(log => log.adherenceStatus === 'on-time').length;
        const adherencePercentage = ((onTimeCount / logs.length) * 100).toFixed(2);

        res.status(200).json({
            status: 'success',
            data: { totalDoses: logs.length, adherencePercentage: `${adherencePercentage}%` }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Soft Delete a medication
 */
export const deleteMedication = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const deletedMed = await Medication.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, isDeleted: false },
            { isDeleted: true, deletedAt: new Date(), isActive: false },
            { session, new: true }
        );

        if (!deletedMed) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Medication not found or already deleted' });
        }

        await recordEvent(req.user._id, req.params.id, 'MED_DELETED', {}, session);

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ status: 'success', message: 'Medication removed safely.' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get medications with low stock
 */
export const getLowStockMeds = async (req, res) => {
    try {
        const meds = await Medication.find({ user: req.user._id, remainingQuantity: { $lt: 5 } });
        res.status(200).json({ status: 'success', data: meds });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get all active medications
 */
export const getMyMeds = async (req, res) => {
    try {
        const meds = await Medication.find({ user: req.user._id }).sort('-createdAt');
        res.status(200).json({ status: 'success', count: meds.length, data: meds });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Refill medication stock
 */
export const refillMedication = async (req, res) => {
    try {
        const { refillAmount } = req.body;
        const updatedMed = await Medication.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, isDeleted: false },
            { $inc: { totalQuantity: refillAmount, remainingQuantity: refillAmount } },
            { new: true }
        );
        if (!updatedMed) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({ status: 'success', data: updatedMed });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Inside your update function in medController.js
export const updateDoseStatus = async (req, res) => {
    try {
        const { status } = req.body; // 'taken' or 'missed'
        const logId = req.params.id;

        // 1. Update the database (using your existing Log model)
        const updatedLog = await Log.findByIdAndUpdate(
            logId, 
            { status }, 
            { new: true }
        ).populate('user');

        // 2. TRIGGER REAL-TIME PULSE
        const io = req.app.get('socketio'); 
        
        // Notify the Patient's app
        io.to(updatedLog.user._id.toString()).emit('dose_updated', {
            message: `Medication marked as ${status}`,
            data: updatedLog
        });

        // Notify the Guardian if they are online
        if (updatedLog.user.guardianEmail) {
            io.to(updatedLog.user.guardianEmail).emit('guardian_update', {
                patientName: updatedLog.user.name,
                status: status,
                time: new Date()
            });
        }

        res.status(200).json({ status: 'success', data: updatedLog });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
// --- HELPERS ---

const calculateDelayInMs = (scheduledTime, userTz = 'UTC') => {
    const now = DateTime.now().setZone(userTz);
    const [hour, minute] = scheduledTime.split(':');
    let scheduled = now.set({ hour: parseInt(hour), minute: parseInt(minute), second: 0, millisecond: 0 });
    if (scheduled < now) scheduled = scheduled.plus({ days: 1 });
    const delay = scheduled.diff(now).milliseconds;
    return Math.max(0, delay);
};
/**
 * @desc    Advanced Search & Filter for Medications
 * @route   GET /api/meds/search
 * @task    Phase 6 - Task 2: Advanced Search
 */
export const searchMedications = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, medType, status } = req.query;

        // 1. Build a dynamic query object
        let query = { user: userId, isDeleted: false };

        // 2. Case-insensitive name search using Regex
        if (name) {
            query.name = { $regex: name, $options: 'i' };
        }

        // 3. Exact match for medType (scheduled/sos)
        if (medType) {
            query.medType = medType;
        }

        // 4. Exact match for status
        if (status) {
            query.status = status;
        }

        const medications = await Medication.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            results: medications.length,
            data: medications
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};