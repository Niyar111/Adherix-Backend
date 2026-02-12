import mongoose from 'mongoose';

const medicationSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' 
    },
    name: {
        type: String,
        required: [true, 'Please add the medication name']
    },
    dosage: {
        type: String,
        required: [true, 'Please add the dosage (e.g., 500mg)']
    },
    medType: {
        type: String,
        enum: ['scheduled', 'prn'],
        default: 'scheduled'
    },
    frequency: {
        type: String,
        required: [true, 'How often should this be taken? (e.g., Twice daily)']
    },
    timings: [{
        type: String, 
        required: true
    }],
    instructions: {
        type: String, 
    },
    totalQuantity: {
        type: Number, 
    },
    remainingQuantity: {
        type: Number, 
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true 
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true 
});

/**
 * QUERY MIDDLEWARE - FIXED
 * Uses an async function to avoid the 'next' callback issue in background workers.
 */
medicationSchema.pre(/^find/, async function() {
    // Task 12: Automatically filter out soft-deleted meds
    this.where({ isDeleted: false });
});

const Medication = mongoose.model('Medication', medicationSchema);
export default Medication;