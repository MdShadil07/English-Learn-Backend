import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/english-practice';
class DatabaseConnection {
    connection = null;
    async connect() {
        try {
            if (this.connection && mongoose.connection.readyState === 1) {
                console.log('✅ Database already connected');
                return;
            }
            console.log('🔄 Connecting to MongoDB...');
            this.connection = await mongoose.connect(MONGODB_URI, {
                // Connection pooling configuration for scalability
                maxPoolSize: 20, // Maximum number of connections in the connection pool
                minPoolSize: 5, // Minimum number of connections in the connection pool
                maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                family: 4, // Use IPv4, skip trying IPv6
                retryWrites: true,
                w: 'majority', // Write concern
                readPreference: 'primary', // Read from primary
                readConcern: { level: 'majority' }, // Read concern
            });
            console.log('✅ MongoDB connected successfully');
            console.log(`📍 Database: ${mongoose.connection.name}`);
            console.log(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
            // Handle connection events
            mongoose.connection.on('error', (error) => {
                console.error('❌ Database connection error:', error);
            });
            mongoose.connection.on('disconnected', () => {
                console.log('📴 Database disconnected');
            });
            mongoose.connection.on('reconnected', () => {
                console.log('🔄 Database reconnected');
            });
        }
        catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error);
            process.exit(1);
        }
    }
    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                console.log('📴 Database disconnected successfully');
            }
        }
        catch (error) {
            console.error('❌ Error disconnecting from database:', error);
        }
    }
    isConnected() {
        return mongoose.connection.readyState === 1;
    }
    getConnection() {
        return mongoose.connection;
    }
}
export const database = new DatabaseConnection();
export default database;
//# sourceMappingURL=database.js.map