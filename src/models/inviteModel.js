import mongoose from 'mongoose';

const guardianInviteSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    receiverEmail: { 
        type: String, 
        required: true,
        lowercase: true,
        trim: true
    },
    token: { 
        type: String, 
        required: true,
        unique: true 
    }, // This will hold the signed JWT or a unique string
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'expired'], 
        default: 'pending' 
    },
    expiresAt: { 
        type: Date, 
        required: true 
    }
}, { timestamps: true });

// Optional: Automatically delete expired invites after a certain time to save space
guardianInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const GuardianInvite = mongoose.model('GuardianInvite', guardianInviteSchema);
export default GuardianInvite;