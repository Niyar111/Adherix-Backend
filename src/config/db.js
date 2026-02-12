import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // This line uses the MONGO_URI from your .env file
        const conn = await mongoose.connect(process.env.MONGO_URI);
        
        console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Database Connection Error: ${error.message}`);
        process.exit(1); // Exit process with failure
    }
};

export default connectDB;