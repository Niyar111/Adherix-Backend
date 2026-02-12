import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import { DateTime } from 'luxon'; // Added to verify Time Engine
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/auth.js';
import medRoutes from './routes/medRoutes.js';

dotenv.config();

const app = express();

// 1. Global Middleware
app.use(cors()); // Essential for Frontend-Backend communication
app.use(express.json()); // Essential for parsing req.body (Task 2 & 4)

// Logger Middleware (Only runs in development mode)
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// 2. Routes
// These routes handle: RBAC, Luxon Time Engine, Pagination, and Search
app.use('/api/auth', authRoutes);
app.use('/api/meds', medRoutes);

/**
 * @desc    Enhanced Health Check
 * Verifies that the server is alive and Luxon is correctly calculating time
 */
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'success', 
        message: 'Adherix Backend is Unbeatable!',
        systemTime: new Date().toISOString(),
        luxonTime: DateTime.now().toISO(),
        timezone: DateTime.now().zoneName,
        environment: process.env.NODE_ENV || 'development'
    });
});

app.use(notFound); 
app.use(errorHandler);

export default app;