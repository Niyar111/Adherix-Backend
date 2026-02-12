import Event from '../models/eventModel.js';

/**
 * @desc Helper to record system events within a session
 */
export const recordEvent = async (userId, medId, type, metadata = {}, session = null) => {
    try {
        const eventData = [{
            user: userId,
            medication: medId,
            eventType: type,
            metadata,
            timestamp: new Date()
        }];

        // If a session exists, participate in the transaction
        const options = session ? { session } : {};
        await Event.create(eventData, options);
    } catch (error) {
        console.error("Critical: Event logging failed", error);
        // We don't throw error here because we don't want to crash the main app 
        // if just the audit logger fails, but in production, you might want to.
    }
};