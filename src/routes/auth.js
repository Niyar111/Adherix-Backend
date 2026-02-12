import express from 'express';
import { 
    registerUser, 
    getUserProfile, 
    updateUserProfile,
    updateTimezone // Task 1: New import for timezone resiliency
} from '../controllers/authcontroller.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Public route for initial sign-up (Firebase UID mapping)
router.post('/register', registerUser);

// @desc    Private routes requiring a valid Firebase Token + Handshake
router.get(
    '/profile', 
    protect, 
    authorize('patient', 'doctor', 'admin'), 
    getUserProfile
);

// @desc    Update profile (Task 5: For Profile Image, Emergency Contact, etc.)
router.put(
    '/profile', 
    protect, 
    authorize('patient', 'doctor', 'admin'), 
    updateUserProfile
);

/**
 * TASK 1: Timezone Resiliency
 * @desc    Dedicated route for updating timezone on location change
 * @access  Private (All roles)
 */
router.patch(
    '/timezone',
    protect,
    authorize('patient', 'doctor', 'admin'),
    updateTimezone
);

export default router;