const mongoose = require('mongoose');

const connectDB = async () => {
    // 1. explicit guard clause
    if (!process.env.MONGO_URI) {
        console.error('❌ FATAL ERROR: MONGO_URI is not defined in environment variables.');
        console.error('👉 Please create a .env file in the root directory and add MONGO_URI=your_connection_string');
        console.error('   Or ensure it is set in your deployment platform (Railway/Heroku/etc).');
        process.exit(1);
    }

    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;
