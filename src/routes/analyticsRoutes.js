import express from 'express';
import { 
    getPatientInsights, 
    getDashboardSummary,
    getComplianceHeatmapController,
    getInventoryRunwayController,
    getTemporalRiskController,
    downloadReport // Task 3: PDF Generation
} from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get high-level overview (Today, 7-day adherence, reliability index)
 * @access  Private
 */
router.get('/dashboard', protect, getDashboardSummary);

/**
 * @route   GET /api/analytics/compliance-heatmap
 * @desc    Get 30-day daily adherence percentages for visual heatmaps
 * @access  Private
 */
router.get('/compliance-heatmap', protect, getComplianceHeatmapController);

/**
 * @route   GET /api/analytics/inventory-runway
 * @desc    Predictive logistics: Days remaining for each medication
 * @access  Private
 */
router.get('/inventory-runway', protect, getInventoryRunwayController);

/**
 * @route   GET /api/analytics/temporal-risk
 * @desc    Behavioral analysis: Categorizes missed doses into Morning/Afternoon/Evening/Night
 * @access  Private
 */
router.get('/temporal-risk', protect, getTemporalRiskController);

/**
 * @route   GET /api/analytics/patterns OR /api/analytics/patterns/:userId
 * @desc    Advanced pattern analysis (Specific time-slot failures)
 * @access  Private (Patient or Authorized Guardian)
 */
router.get(['/patterns', '/patterns/:userId'], protect, getPatientInsights);

/**
 * @route   GET /api/analytics/download-report
 * @desc    Task 3: Generate and download clinical PDF adherence report
 * @access  Private
 */
router.get('/download-report', protect, downloadReport);

export default router;