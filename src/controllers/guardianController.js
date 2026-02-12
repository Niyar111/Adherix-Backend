import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import Connection from '../models/connectionModel.js';
import GuardianInvite from '../models/inviteModel.js'; 
import User from '../models/userModel.js';
import Log from '../models/logModel.js';
import Medication from '../models/medModel.js'; // Added for getPatientMeds
import { sendInviteEmail } from '../utils/emailService.js';

/**
 * @desc    Send a secure JWT-based invite to a Guardian (Patient initiates)
 * @route   POST /api/guardian/invite
 */
export const inviteGuardian = async (req, res) => {
    try {
        const { guardianEmail } = req.body;
        const patientId = req.user._id;
        const patientName = req.user.name || "A Patient";

        if (guardianEmail === req.user.email) {
            return res.status(400).json({ status: 'fail', message: 'You cannot be your own guardian.' });
        }

        const existingInvite = await GuardianInvite.findOne({ 
            sender: patientId, 
            receiverEmail: guardianEmail.toLowerCase(), 
            status: 'pending' 
        });

        if (existingInvite) {
            return res.status(400).json({ status: 'fail', message: 'An invite is already pending for this email.' });
        }

        const token = jwt.sign(
            { patientId, receiverEmail: guardianEmail.toLowerCase() }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' } 
        );

        await GuardianInvite.create({
            sender: patientId,
            receiverEmail: guardianEmail.toLowerCase(),
            token,
            expiresAt: DateTime.now().plus({ hours: 24 }).toJSDate()
        });

        const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;
        
        try {
            await sendInviteEmail(guardianEmail, inviteUrl, patientName);
        } catch (mailError) {
            console.error("Mail Service Error:", mailError);
        }

        res.status(201).json({ 
            status: 'success', 
            message: `Secure invite generated and sent to ${guardianEmail}`,
            inviteUrl 
        });

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * @desc    Accept/Reject an invite via JWT Handshake (Guardian initiates)
 * @route   POST /api/guardian/respond-invite
 */
export const respondToInvite = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { token, action } = req.body; 

        jwt.verify(token, process.env.JWT_SECRET);
        
        const invite = await GuardianInvite.findOne({ 
            token, 
            status: 'pending' 
        }).session(session);

        if (!invite) {
            throw new Error('Invitation not found, already processed, or expired.');
        }

        if (action === 'accepted') {
            await Connection.create([{
                patientId: invite.sender,
                guardianId: req.user._id, 
                status: 'active',
                initiatedBy: invite.sender
            }], { session });

            invite.status = 'accepted';
        } else {
            invite.status = 'rejected';
        }

        await invite.save({ session });
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ 
            status: 'success', 
            message: `Invitation ${action} successfully.` 
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

/**
 * @desc    Get Patient's Medication List (Guardian View - Role Based)
 * @route   GET /api/meds/patient/:patientId
 * @task    Phase 4 - Task 2: RBAC
 */
export const getPatientMeds = async (req, res) => {
    try {
        const { patientId } = req.params;

        // Verify active connection exists between this Guardian and Patient
        const connection = await Connection.findOne({
            patientId,
            guardianId: req.user._id,
            status: 'active'
        });

        if (!connection) {
            return res.status(403).json({ 
                status: 'fail', 
                message: 'Unauthorized: You are not an authorized guardian for this patient.' 
            });
        }

        // Fetch non-deleted medications for the patient
        const meds = await Medication.find({ user: patientId, isDeleted: false });
        
        res.status(200).json({ status: 'success', data: meds });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get Patient Health Data (Role-Based Access Control)
 * @route   GET /api/guardian/patient-report/:patientId
 */
export const getPatientReport = async (req, res) => {
    try {
        const { patientId } = req.params;
        const guardianId = req.user._id;

        const connection = await Connection.findOne({
            patientId,
            guardianId,
            status: 'active'
        });

        if (!connection) {
            return res.status(403).json({ 
                status: 'fail', 
                message: 'Access Denied: You are not an authorized guardian for this patient.' 
            });
        }

        const sevenDaysAgo = DateTime.now().minus({ days: 7 }).startOf('day').toJSDate();
        
        const adherenceData = await Log.aggregate([
            { 
                $match: { 
                    user: new mongoose.Types.ObjectId(patientId), 
                    takenAt: { $gte: sevenDaysAgo } 
                } 
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$takenAt" } },
                    totalDoses: { $sum: 1 },
                    takenCount: {
                        $sum: { $cond: [{ $eq: ["$status", "taken"] }, 1, 0] }
                    },
                    missedCount: {
                        $sum: { $cond: [{ $eq: ["$status", "missed"] }, 1, 0] }
                    }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const formattedReport = adherenceData.map(day => {
            const dateObj = DateTime.fromISO(day._id);
            return {
                date: day._id,
                dayName: dateObj.weekdayShort,
                adherenceScore: day.totalDoses > 0 ? ((day.takenCount / day.totalDoses) * 100).toFixed(0) : 0,
                taken: day.takenCount,
                missed: day.missedCount,
                total: day.totalDoses
            };
        });

        res.status(200).json({ 
            status: 'success', 
            patientId,
            range: 'Last 7 Days',
            data: formattedReport 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * @desc    Get all active connections for a user
 * @route   GET /api/guardian/my-connections
 */
export const getMyConnections = async (req, res) => {
    try {
        const connections = await Connection.find({
            $or: [{ patientId: req.user._id }, { guardianId: req.user._id }],
            status: 'active'
        }).populate('patientId guardianId', 'name email photoUrl');

        res.status(200).json({ status: 'success', data: connections });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};