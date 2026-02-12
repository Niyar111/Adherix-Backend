import mongoose from 'mongoose';

const logSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId, // Changed to ObjectId for better querying
        required: true,
        ref: 'User'
    },
    medication: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Medication'
    },
    status: {
        type: String,
        enum: ['taken', 'missed', 'skipped'], // Updated to match clinical reality
        default: 'taken'
    },
    // The specific time from the medication's timing array (e.g., "08:00")
    scheduledTime: {
        type: String,
        required: true
    },
    // How many minutes late was the dose? (0 if on-time or missed)
    delayMinutes: {
        type: Number,
        default: 0
    },
    // The categorical result of the "Brain" logic
    adherenceStatus: {
        type: String,
        enum: ['on-time', 'late', 'missed'],
        required: true
    },
    takenAt: {
        type: Date,
        default: Date.now 
    }
}, { timestamps: true });

// Indexing for faster history lookups and Reaper scans
logSchema.index({ medication: 1, createdAt: -1 });

const Log = mongoose.model('Log', logSchema);
export default Log;