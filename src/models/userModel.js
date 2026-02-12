import mongoose from 'mongoose';

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true
    },
    firebaseUid: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['patient', 'guardian', 'doctor', 'admin'],
        default: 'patient'
    },
    photoUrl: {
        type: String,
        default: ''
    },
    timezone: {
        type: String,
        default: 'UTC' // Critical for Task 1: Timezone Resiliency
    },
    // TASK 5: Firebase Cloud Messaging Token
    // This is the unique "address" of the user's physical phone.
    fcmToken: {
        type: String,
        default: null
    },
    emergencyContact: {
        name: String,
        phone: String
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;