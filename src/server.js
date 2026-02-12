import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet'; 
import rateLimit from 'express-rate-limit'; 
import connectDB from './config/db.js';
import mongoose from 'mongoose';
import http from 'http'; // Socket.io Support
import { Server } from 'socket.io'; // Real-time Engine

// Route Imports
import authRoutes from './routes/auth.js'; 
import medRoutes from './routes/medRoutes.js';
import guardianRoutes from './routes/guardianRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

// Redis & Worker Imports
import { adherenceQueue, redisConnection } from './config/redis.js'; 
import adherenceWorker from './workers/adherenceWorker.js'; 
import './workers/purgeWorker.js'; 

// Utilities
import { runAutomatedReaper } from './utils/reaper.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

/**
 * --- PHASE 6: SECURITY HARDENING ---
 */
// 1. HELMET: Secure HTTP headers
app.use(helmet()); 

// 2. RATE LIMITER: Prevent API abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: {
        status: 'error',
        message: 'Too many requests, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter); // Protect all routes

/**
 * --- REAL-TIME SERVER INITIALIZATION ---
 * We wrap Express with HTTP to support both API and WebSockets
 */
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Inject io into request object for controllers
app.set('socketio', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/meds', medRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/analytics', analyticsRoutes);

/**
 * --- SOCKET.IO CONNECTION LOGIC ---
 */
io.on('connection', (socket) => {
    console.log(`⚡ Live Pulse connection: ${socket.id}`);

    socket.on('join', (roomID) => {
        socket.join(roomID);
        console.log(`👤 User joined private room: ${roomID}`);
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected from Live Pulse');
    });
});

/**
 * --- SYSTEM HEALTH & SECURITY MONITORING ---
 * This provides a live diagnostic dashboard for your presentation
 */
app.get('/api/admin/health', async (req, res) => {
    const health = {
        uptime: process.uptime(),
        timestamp: new Date(),
        services: {
            database: mongoose.connection.readyState === 1 ? 'Healthy' : 'Disconnected',
            redis: redisConnection.status === 'ready' ? 'Connected' : 'Disconnected',
            socket: io.engine.clientsCount > 0 ? 'Active' : 'Idle',
            // --- NEW SECURITY MONITORING FIELDS ---
            security: {
                helmet: 'Active',
                rateLimit: 'Active (100req/15min)',
                cors: 'Enabled'
            }
        }
    };
    
    try {
        const jobCount = await adherenceQueue.getJobCounts();
        health.queueStatus = jobCount;
        res.status(200).json(health);
    } catch (error) {
        health.message = error.message;
        res.status(503).json(health);
    }
});

app.get('/', (req, res) => {
    res.send('🚀 Adherix Backend: Phase 6 Production Hardening Active.');
});

app.get('/api/test-reaper', async (req, res) => {
    // Manually trigger reaper with live pulse support
    const count = await runAutomatedReaper(io);
    res.json({ message: 'Reaper manual run complete', missedProcessed: count });
});

/**
 * --- AUTOMATED TASKS CONFIGURATION ---
 */
const startAutomatedTasks = async (socketInstance) => {
    try {
        const repeatableJobs = await adherenceQueue.getRepeatableJobs();
        for (let job of repeatableJobs) {
            await adherenceQueue.removeRepeatableByKey(job.key);
        }

        // 1. Hourly Reaper Scan
        await adherenceQueue.add('run-reaper', { hasSocket: true }, {
            repeat: { pattern: '0 * * * *' },
            removeOnComplete: true,
        });
        
        // 2. Daily Data Hygiene
        await adherenceQueue.add('daily-cleanup', {}, {
            repeat: { pattern: '0 0 * * *' },
            removeOnComplete: true,
        });
        
        console.log('⏰ Automated tasks scheduled with Socket.io support');
    } catch (error) {
        console.error('❌ Redis task failure:', error.message);
    }
};

const PORT = process.env.PORT || 5000;

/**
 * START PRODUCTION SERVER
 */
server.listen(PORT, () => {
    console.log(`🚀 Adherix Secure Server running on port ${PORT}`);
    
    // Initialize background worker with Live Pulse
    adherenceWorker(io); 
    
    // Start automated task heartbeats
    startAutomatedTasks(io);
});