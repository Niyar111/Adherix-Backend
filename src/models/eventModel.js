import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medication: { type: mongoose.Schema.Types.ObjectId, ref: 'Medication' },
    eventType: { 
        type: String, 
        required: true,
        enum: [
            'DOSE_TAKEN', 
            'DOSE_MISSED', 
            'DOSE_LATE', 
            'INVENTORY_LOW', 
            'GUARDIAN_ALERT_SENT',
            'MED_DELETED'
        ]
    },
    metadata: { type: Object }, // Store extra info like { delay: 45 } or { stock: 2 }
    timestamp: { type: Date, default: Date.now }
});

const Event = mongoose.model('Event', eventSchema);
export default Event;