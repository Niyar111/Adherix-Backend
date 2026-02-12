import mongoose from 'mongoose';

const connectionSchema = mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    guardianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'rejected'],
        default: 'pending'
    },
    // Useful for the UI to show "Sent" vs "Received" invites
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Prevent duplicate invite requests
connectionSchema.index({ patientId: 1, guardianId: 1 }, { unique: true });

const Connection = mongoose.model('Connection', connectionSchema);
export default Connection;