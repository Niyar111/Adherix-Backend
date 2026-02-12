import admin from '../config/firebase.js';
import User from '../models/userModel.js';

/**
 * @desc    Verify Firebase Token and attach MongoDB User to Request
 * @access  Private
 */
export const protect = async (req, res, next) => {
    let token;

    // 1. Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token from "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify token with Firebase Admin SDK
            const decodedToken = await admin.auth().verifyIdToken(token);

            // 3. Find the user in MongoDB using the firebaseUid
            // This pulls the MongoDB _id, role, and timezone into req.user
            const user = await User.findOne({ firebaseUid: decodedToken.uid });

            if (!user) {
                return res.status(404).json({ 
                    status: 'fail', 
                    message: 'User not found in Adherix database. Please complete registration.' 
                });
            }

            // 4. Attach the full MongoDB User object to the request
            req.user = user;

            next();
        } catch (error) {
            console.error('Auth Error:', error.message);
            return res.status(401).json({ 
                status: 'fail', 
                message: 'Not authorized, token invalid or expired' 
            });
        }
    }

    if (!token) {
        return res.status(401).json({ 
            status: 'fail', 
            message: 'Not authorized, no token provided' 
        });
    }
};

/**
 * @desc    Restrict access to specific roles
 * @param   {...string} roles - e.g., 'patient', 'doctor'
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        // req.user is populated by 'protect'
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'fail',
                message: `Forbidden: Access restricted to ${roles.join(' or ')} role(s).`
            });
        }
        next();
    };
};