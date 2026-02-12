import express from 'express';
import { 
    addMedication, 
    getMyMeds, 
    logDose, 
    getMedHistory, 
    getAdherenceReport,
    updateMedication,
    deleteMedication,
    getLowStockMeds,
    refillMedication,
    searchMedications // Task 2: Advanced Search
} from '../controllers/medController.js';
import { getPatientMeds } from '../controllers/guardianController.js'; 
import { runAutomatedReaper } from '../utils/reaper.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- Medication Management (Patient Only) ---

/**
 * @route   GET /api/meds/search
 * @desc    Task 2: Advanced Search & Filter (Regex-based)
 * @access  Private
 * IMPORTANT: Must be defined BEFORE /:id routes
 */
router.get('/search', protect, searchMedications); 

router.post('/add', protect, addMedication);
router.get('/all', protect, getMyMeds);
router.get('/low-stock', protect, getLowStockMeds);
router.put('/update/:id', protect, updateMedication);
router.delete('/delete/:id', protect, deleteMedication);
router.patch('/:id/refill', protect, refillMedication);

// --- Guardian Access (Role-Based) ---
router.get('/patient/:patientId', protect, getPatientMeds);

// --- Adherence & Logs ---
router.post('/log', protect, logDose);
router.get('/history/:medId', protect, getMedHistory);
router.get('/report', protect, getAdherenceReport);

// --- Testing ---
router.get('/test-reaper', protect, runAutomatedReaper);

export default router;