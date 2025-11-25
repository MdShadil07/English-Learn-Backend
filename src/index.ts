import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import cluster from 'cluster';
import os from 'os';
import path from 'path';

// Import database connection
import { database } from './config/database.js';

// Import Redis cache
import { redisCache } from './config/redis.js';

// Import clustering
import { clusterManager } from './utils/handlers/cluster.js';

// Import enhanced error handling and monitoring
import { enhancedHealthCheck, errorHandler } from './utils/handlers/errorHandler.js';

// Import middleware
import { apiRateLimit } from './middleware/security/rateLimit.js';
import security from './middleware/security/security.js';

// Import routes
import authRoutes from './routes/auth/auth.js';
import progressRoutes from './routes/Progress/progress.js';
import optimizedProgressRoutes from './routes/Progress/optimizedProgress.routes.js';
import userRoutes from './routes/User/user.js';
import profileRoutes from './routes/Profile/profile.js';
import accuracyRoutes from './routes/Accuracy/accuracy.js';
import userLevelRoutes from './routes/UserLevel/userLevel.routes.js';
import aiChatRoutes from './controllers/Ai Chat/aiChatController.js';
import aiChatSettingsRoutes from './routes/Ai Chat/aiChatSettings.routes.js';
import analyticsRoutes from './routes/Analytics/analytics.routes.js';
import paymentRoutes from './routes/Subscription/payment.routes.js';
import subscriptionRoutes from './routes/Subscription/subscription.routes.js';

// Import monitoring controller
import { monitoringController } from './controllers/Monitoring/monitoring.controller.js';
import subscriptionService from './services/Subscription/subscriptionService.js';

// Connect to database and cache
async function initializeServices() {
  try {
    // Connect to MongoDB first
    await database.connect();

    // Then connect to Redis (optional, app can work without it)
    try {
      await redisCache.connect();
    } catch (error) {
      console.warn('⚠️ Redis not available, running without cache');
      // Don't log the error, just continue without Redis
    }

    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start server with clustering in production
if (process.env.NODE_ENV === 'production' && cluster.isPrimary) {
  console.log('🚀 Starting production server with clustering...');
  clusterManager.start();
} else {
  // Development mode or worker process
  startServer();
}

async function startServer(): Promise<void> {
  try {
    // Connect to database and cache
    await initializeServices();

    const app = express();
    const PORT = process.env.PORT || 5000;

    // Security middleware
    app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration (use centralized corsOptions to allow multiple dev origins)
    app.use(cors(security.corsOptions));

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static file serving for uploads
    app.use('/api/files', express.static(path.join(process.cwd(), 'uploads'), {
      maxAge: '1d', // Cache for 1 day
      etag: true,
      lastModified: true
    }));

    // Compression middleware with optimized settings for scalability
    app.use(compression({
      level: 6, // Compression level (1-9, higher = more compression but slower)
      threshold: 1024, // Only compress responses larger than 1KB
      filter: (req, res) => {
        // Don't compress responses with this request header
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Use compression filter function
        return compression.filter(req, res);
      },
    }));

    // Logging middleware
    if (process.env.NODE_ENV === 'development') {
      app.use(morgan('dev'));
    } else {
      app.use(morgan('combined'));
    }

    // Rate limiting
    app.use('/api/', apiRateLimit);

    // Health check endpoint with performance metrics
    app.get('/health', enhancedHealthCheck);

    // Enhanced monitoring endpoints
    app.get('/ready', monitoringController.readinessCheck.bind(monitoringController));
    app.get('/live', monitoringController.livenessCheck.bind(monitoringController));
    app.get('/metrics', monitoringController.getMetrics.bind(monitoringController));
    app.get('/metrics/prometheus', monitoringController.prometheusMetrics.bind(monitoringController));

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/progress', progressRoutes);
    app.use('/api/progress/optimized', optimizedProgressRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/accuracy', accuracyRoutes);
    app.use('/api/user-level', userLevelRoutes);
    app.use('/api/ai-chat', aiChatRoutes);
    app.use('/api/ai-chat/settings', aiChatSettingsRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/payment', paymentRoutes);
    app.use('/api/subscription', subscriptionRoutes);

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
      });
    });

    // Global error handler
    app.use(errorHandler);

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('✅ HTTP server closed');

        try {
          await Promise.all([
            database.disconnect(),
            redisCache.disconnect()
          ]);
          console.log('✅ Database and cache disconnected');
        } catch (error) {
          console.error('❌ Error during service disconnect:', error);
        }

        console.log('👋 Process terminated');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('⏰ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`
🚀 Server started successfully!
📍 Running on: http://localhost:${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📊 API Base URL: http://localhost:${PORT}/api
💾 Database: ${database.isConnected() ? '✅ Connected' : '❌ Not connected'}
${redisCache.isConnected() ? '🔄 Cache: ✅ Connected' : '🔄 Cache: ❌ Not connected'}
${process.env.NODE_ENV === 'production' ? `👥 Workers: ${clusterManager.getWorkerCount()}` : ''}
      `);

      if (process.env.NODE_ENV === 'development') {
        console.log('\n📋 Available endpoints:');
        console.log('  POST /api/auth/register - User registration');
        console.log('  POST /api/auth/login - User login');
        console.log('  POST /api/auth/refresh-token - Refresh access token');
        console.log('  GET  /api/auth/profile - Get user profile');
        console.log('  PUT  /api/auth/profile - Update user profile');
        console.log('  POST /api/auth/logout - Logout');
        console.log('  POST /api/auth/logout-all - Logout from all devices');
        console.log('  GET  /health - Health check');
      }
    });

    // Background job: expire subscriptions that passed endDate
    const expireIntervalMs = Number(process.env.SUBSCRIPTION_EXPIRY_CHECK_MS || 1000 * 60 * 60); // default 1 hour
    const expireTask = async () => {
      try {
        await subscriptionService.revokeExpiredSubscriptions();
      } catch (err) {
        console.error('Error running subscription expiry task', err);
      }
    };

    // Start periodic expiry checks
    setInterval(expireTask, expireIntervalMs);

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}
