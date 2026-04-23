import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import database connection
import { database } from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to database
database.connect().catch(console.error);

// Basic middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: database.isConnected() ? 'connected' : 'disconnected',
  });
});

// Simple auth test
app.post('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test endpoint working',
    data: req.body,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`💾 Database: ${database.isConnected() ? '✅ Connected' : '❌ Not connected'}`);
});

export default app;
