import User from '../models/userModel.js';

// @desc    Register a new user profile
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
    const { name, email, firebaseUid, role, timezone } = req.body;

    try {
        const userExists = await User.findOne({ firebaseUid });
        if (userExists) {
            return res.status(200).json({ status: 'success', data: userExists });
        }

        const user = await User.create({
            name,
            email,
            firebaseUid,
            role: role || 'patient',
            timezone: timezone || 'UTC' 
        });

        res.status(201).json({ status: 'success', data: user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current user profile (Handshake)
export const getUserProfile = async (req, res) => {
    if (req.user) {
        res.status(200).json({
            status: 'success',
            data: req.user 
        });
    } else {
        res.status(404).json({ message: 'User profile not found' });
    }
};

/**
 * TASK 1: Timezone Resiliency
 * @desc    Explicitly update user timezone for location-based reminders
 * @route   PATCH /api/auth/timezone
 */
export const updateTimezone = async (req, res) => {
    try {
        const { timezone } = req.body; // e.g., "Asia/Kolkata" or "Europe/London"

        if (!timezone) {
            return res.status(400).json({ message: "Timezone string is required" });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { timezone },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 'success',
            message: `Timezone updated to ${timezone}. Reminders will follow this zone.`,
            data: { timezone: user.timezone }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Update user profile + Task 5 (FCM Token Support)
 * @route   PUT /api/auth/profile
 */
export const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            // Update basic fields
            user.name = req.body.name || user.name;
            user.photoUrl = req.body.photoUrl || user.photoUrl;
            user.timezone = req.body.timezone || user.timezone; 
            
            // Task 5: FCM Token Foundation for Push Notifications
            // The Flutter app will send this token to register the device
            if (req.body.fcmToken) {
                user.fcmToken = req.body.fcmToken;
            }
            
            // Emergency Contact Logic
            if (req.body.emergencyContact) {
                user.emergencyContact = {
                    name: req.body.emergencyContact.name || user.emergencyContact.name,
                    phone: req.body.emergencyContact.phone || user.emergencyContact.phone
                };
            }

            const updatedUser = await user.save();
            
            res.status(200).json({ 
                status: 'success', 
                message: 'Profile updated successfully',
                data: updatedUser 
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};