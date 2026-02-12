import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
    inviteGuardian, 
    respondToInvite, 
    getPatientReport,
    getMyConnections // Added for Task 4 UI support
} from '../controllers/guardianController.js';

const router = express.Router();

// @desc    Invite a guardian (Patient initiated)
router.post('/invite', protect, inviteGuardian);

// @desc    Accept/Reject an invite (Guardian initiated)
router.patch('/respond/:connectionId', protect, respondToInvite);

/**
 * TASK 4: Deep Weekly Aggregator
 * @desc    Get the 7-day adherence breakdown (Guardian access only)
 */
router.get('/patient-report/:patientId', protect, getPatientReport);

// @desc    List all connections (Pending & Active) for the current user
router.get('/my-connections', protect, getMyConnections);

export default router;