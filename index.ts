import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';

// Import routes
import { userRoutes } from './src/routes/user';
import { profileRoutes } from './src/routes/Profile';
import { accuracyRoutes } from './src/routes/Accuracy';
import { progressRoutes } from './src/routes/Progress';
import { userLevelRoutes } from './src/routes/UserLevel';
import { authRoutes } from './src/routes/auth';

// Import WebSocket service
import { webSocketService } from './src/services/WebSocket/socketService';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/english-practice', {
  // Remove deprecated options
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/accuracy', accuracyRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/level', userLevelRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Initialize WebSocket server
webSocketService.initialize(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 WebSocket server ready for connections`);
});
