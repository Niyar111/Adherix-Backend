import Log from '../models/logModel.js';
import Medication from '../models/medModel.js';
import { 
    getBehavioralPatterns, 
    calculateReliabilityIndex, 
    getComplianceHeatmap,
    getInventoryRunway,
    getTemporalRiskAnalysis,
    getNextDoseDiscovery 
} from '../services/analyticsService.js';
import { generateAdherencePDF } from '../services/reportService.js'; // Task 3
import { DateTime } from 'luxon';
import mongoose from 'mongoose';

/**
 * @desc    Get high-performance clinical summary for the Dashboard
 * @route   GET /api/analytics/dashboard
 * @task    Phase 5 - Task 5: Quick-Action Engine
 */
export const getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user._id;
        const userTz = req.user.timezone || 'UTC';
        const now = DateTime.now().setZone(userTz);
        const todayStart = now.startOf('day').toJSDate();
        const todayEnd = now.endOf('day').toJSDate();

        // 1. Today's Clinical Progress
        const todayLogs = await Log.find({ 
            user: userId, 
            createdAt: { $gte: todayStart, $lte: todayEnd } 
        });

        const takenToday = todayLogs.filter(l => l.status === 'taken').length;
        const totalToday = todayLogs.length;

        // 2. Clinical Reliability Index
        const reliabilityIndex = await calculateReliabilityIndex(userId);

        // 3. Next Dose Discovery
        const nextDose = await getNextDoseDiscovery(userId);

        res.status(200).json({
            status: 'success',
            data: {
                summary: { 
                    taken: takenToday, 
                    total: totalToday,
                    percentage: totalToday > 0 ? ((takenToday / totalToday) * 100).toFixed(0) : 0
                },
                clinicalMetrics: {
                    reliabilityIndex: `${reliabilityIndex} Days`,
                    status: reliabilityIndex >= 7 ? 'Stable' : 'Monitoring Required'
                },
                nextAction: nextDose ? {
                    message: `Next dose: ${nextDose.medName} at ${nextDose.scheduledTime}`,
                    remainingMinutes: Math.round(nextDose.diffInMinutes),
                    medId: nextDose.medId
                } : "No upcoming doses found",
                timestamp: now.toISO()
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * @desc    Get 30-day compliance heatmap data
 * @route   GET /api/analytics/compliance-heatmap
 * @task    Phase 5 - Task 2: Visual Trends
 */
export const getComplianceHeatmapController = async (req, res) => {
    try {
        const userId = req.user._id;
        const data = await getComplianceHeatmap(userId);
        res.status(200).json({ status: 'success', results: data.length, data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * @route   GET /api/analytics/inventory-runway
 * @desc    Predictive logistics: Days remaining for medication
 */
export const getInventoryRunwayController = async (req, res) => {
    try {
        const userId = req.user._id;
        const reports = await getInventoryRunway(userId);
        res.status(200).json({ status: 'success', count: reports.length, data: reports });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * @route   GET /api/analytics/temporal-risk
 * @desc    Behavioral risk categories (Morning/Afternoon/Evening/Night)
 */
export const getTemporalRiskController = async (req, res) => {
    try {
        const userId = req.user._id;
        const analysis = await getTemporalRiskAnalysis(userId);
        res.status(200).json({ status: 'success', data: analysis });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * @desc    Detailed pattern analysis (Specific time-slot failures)
 * @route   GET /api/analytics/patterns/:userId
 */
export const getPatientInsights = async (req, res) => {
    try {
        const userId = req.params.userId || req.user._id;
        const patterns = await getBehavioralPatterns(userId);

        if (!patterns || patterns.length === 0) {
            return res.status(200).json({ 
                status: 'success', 
                message: 'Perfect adherence! No negative patterns detected.',
                data: [] 
            });
        }

        res.status(200).json({
            status: 'success',
            insight: "Pattern analysis complete for the last 30 days.",
            data: patterns
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * @desc    Generate and download a professional PDF Adherence Report
 * @route   GET /api/analytics/download-report
 * @task    Phase 6 - Task 3: Professional Documentation
 */
export const downloadReport = async (req, res) => {
    try {
        const userId = req.user._id;
        const userName = req.user.name || 'Patient';
        const userEmail = req.user.email;

        // 1. Fetch Real-Time Metrics for the Report
        const reliabilityIndex = await calculateReliabilityIndex(userId);
        const heatmapData = await getComplianceHeatmap(userId);
        
        // 2. Fetch recent logs for the detailed history section
        const recentLogs = await Log.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('medication', 'name');

        // 3. Construct Data Packet for the PDF Engine
        const reportData = {
            user: { name: userName, email: userEmail },
            reliability: reliabilityIndex,
            summary: {
                status: reliabilityIndex >= 7 ? 'Stable' : 'Monitoring Required',
                totalLogsAnalysed: heatmapData.length
            },
            logs: recentLogs.map(log => ({
                medName: log.medication?.name || 'Unknown Medication',
                scheduledTime: log.scheduledTime,
                status: log.status,
                date: DateTime.fromJSDate(log.createdAt).toLocaleString(DateTime.DATE_MED)
            }))
        };

        // 4. Set PDF Response Headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Adherix_Report_${userName}.pdf`);

        // 5. Stream the PDF directly to the browser
        generateAdherencePDF(reportData, res);

    } catch (error) {
        console.error('❌ PDF Generation Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate PDF report' });
    }
};