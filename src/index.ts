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
import monitorAuth from './middleware/monitorAuth.js';
import requestMetrics from './middleware/requestMetrics.js';
import routeMetrics from './middleware/routeMetrics.js';
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

    // Attach lightweight request metrics middleware early so it captures all requests
    app.use(requestMetrics.middleware);
    // Attach per-route timing middleware to capture latencies for endpoints
    app.use(routeMetrics.middleware);

    // Serve a simple landing page for root and any static assets in /public
    // This makes the backend return a friendly page when deployed and hit at '/'
    const publicPath = path.join(process.cwd(), 'public');
    app.use(express.static(publicPath, {
      index: false,
      maxAge: '1d'
    }));

    app.get('/', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });

    // Monitoring dashboard entry (small API-key prompt) -> redirects to SPA
    app.get('/monitor', (req, res) => {
      res.sendFile(path.join(publicPath, 'monitor-entry.html'));
    });

    // Redirect any legacy /monitor-app routes to single `/monitor` entry
    app.get(['/monitor-app', '/monitor-app/', '/monitor-app/*'], (req, res) => {
      res.redirect(302, '/monitor');
    });
    // Redirect legacy server-rendered monitor page to unified `/monitor` entry
    app.get('/monitor-ts', (req, res) => res.redirect(302, '/monitor'));
    app.get('/monitor/stream', monitorAuth, monitoringController.streamMetrics.bind(monitoringController));
    app.get('/monitor/counts', monitorAuth, async (req, res) => {
      // lightweight counts endpoint
      const monitoringService = (await import('./services/Monitoring/monitoringService.js')).default;
      const counts = await monitoringService.getCounts();
      res.json(counts);
    });

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
    app.get('/monitor/realtime', monitorAuth, monitoringController.realtimeMetrics.bind(monitoringController));
    // Alert rule management endpoints
    app.get('/monitor/alerts', monitorAuth, async (req, res) => {
      const svc = (await import('./services/Monitoring/alertService.js')).default
      const active = await svc.getActiveAlerts()
      res.json(active)
    })

    app.get('/monitor/alerts/rules', monitorAuth, async (req, res) => {
      const svc = (await import('./services/Monitoring/alertService.js')).default
      res.json(await svc.listRules())
    })

    // Return the list of tracked routes and basic stats
    app.get('/monitor/routes', monitorAuth, async (req, res) => {
      try {
        const rm = (await import('./middleware/routeMetrics.js')).default
        const stats = rm.getStats().map((r: any) => ({ route: r.route, count: r.count, avg: r.avg, p95: r.p95 }))
        res.json({ routes: stats })
      } catch (e) {
        res.status(500).json({ error: 'failed to list routes' })
      }
    })

    // Return all declared Express routes (introspection) so the UI can show un-hit routes
    app.get('/monitor/routes/all', monitorAuth, (req, res) => {
      try {
        const routes: string[] = []
        const stack = (app as any)._router && (app as any)._router.stack ? (app as any)._router.stack : []
        for (const layer of stack) {
          if (!layer || !layer.route) continue
          const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(',')
          const path = layer.route.path || ''
          routes.push(`${methods} ${path}`)
        }
        routes.sort()
        res.json({ routes })
      } catch (e) {
        res.status(500).json({ error: 'failed to introspect routes' })
      }
    })

    // Server-side load runner: POST /monitor/test/run
    // Body: { target: string, total: number, concurrency: number }
    app.post('/monitor/test/run', monitorAuth, express.json(), async (req, res) => {
      try {
        const { target, total = 100, concurrency = 10 } = req.body || {}
        if (!target || typeof target !== 'string') return res.status(400).json({ error: 'invalid target' })
        const maxTotal = 5000
        const maxConcurrency = 200
        const tTotal = Math.min(Number(total) || 100, maxTotal)
        const tConc = Math.min(Math.max(1, Number(concurrency) || 10), maxConcurrency)

        const headers: any = {}
        // If server has a MONITOR_API_KEY, include it to hit protected endpoints
        if (process.env.MONITOR_API_KEY) headers['x-monitor-api-key'] = process.env.MONITOR_API_KEY

        const perWorker = Math.ceil(tTotal / tConc)
        let success = 0
        let fail = 0
        const timings: number[] = []

        const worker = async (count: number) => {
          for (let i = 0; i < count; i++) {
            const start = Date.now()
            try {
              const r = await fetch(target, { method: 'GET', headers })
              if (r.ok) success++
              else fail++
            } catch (e) {
              fail++
            } finally {
              timings.push(Date.now() - start)
            }
          }
        }

        const pools: Promise<void>[] = []
        for (let i = 0; i < tConc; i++) pools.push(worker(perWorker))
        const t0 = Date.now()
        await Promise.all(pools)
        const t1 = Date.now()

        const avg = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : undefined
        const result = { timestamp: new Date().toISOString(), target, total: tTotal, concurrency: tConc, success, fail, avgMs: avg, durationMs: t1 - t0 }

        // persist to redis test history
        try {
          const { redisCache } = await import('./config/redis.js')
          const key = 'monitor:test:history'
          const hist = (await redisCache.getJSON<any[]>(key)) || []
          hist.unshift(result)
          hist.splice(100)
          await redisCache.setJSON(key, hist, 24 * 3600)
        } catch (e) {}

        return res.json(result)
      } catch (e) {
        console.error('test run error', e)
        return res.status(500).json({ error: 'test run failed' })
      }
    })

    // Alert history endpoint
    app.get('/monitor/alerts/history', monitorAuth, async (req, res) => {
      try {
        const svc = (await import('./services/Monitoring/alertService.js')).default
        const hist = await svc.listHistory()
        res.json(hist)
      } catch (e) {
        res.status(500).json({ error: 'failed to fetch alert history' })
      }
    })

    app.post('/monitor/alerts/rules', monitorAuth, express.json(), async (req, res) => {
      const svc = (await import('./services/Monitoring/alertService.js')).default
      const rule = req.body
      // simple validation
      if (!rule || !rule.id || !rule.type || !rule.threshold) return res.status(400).json({ error: 'invalid rule' })
      await svc.addRule(rule)
      return res.status(201).json({ ok: true })
    })

    app.delete('/monitor/alerts/rules/:id', monitorAuth, async (req, res) => {
      const svc = (await import('./services/Monitoring/alertService.js')).default
      await svc.removeRule(req.params.id)
      res.json({ ok: true })
    })

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
