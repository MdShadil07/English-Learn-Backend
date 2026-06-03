import express from 'express';
import os from 'os';
import { telemetryService } from '../../services/telemetryService.js';
import { presenceService } from '../../services/Presence/presenceService.js';
import { DailyServiceMetric } from '../../models/DailyServiceMetric.js';
import User from '../../models/User.js';

const router = express.Router();

/**
 * Internal route for the Admin Backend to fetch live telemetry
 * We don't apply standard user authentication here because it's meant to be called server-to-server.
 * In a real production environment with multiple nodes, you would secure this with an internal secret.
 */
router.get('/', async (req, res) => {
  try {
    const [liveMetrics, activeUsers] = await Promise.all([
      telemetryService.getLiveTodayMetrics(),
      presenceService.getOnlineUsersCount()
    ]);
    
    // Gather main backend system metrics
    const uptimeSeconds = process.uptime();
    const memory = process.memoryUsage();
    const cpuLoad = os.loadavg();

    return res.json({
      success: true,
      data: liveMetrics,
      system: {
        service: 'main-backend',
        activeUsers,
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptimeSeconds,
        memory: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          external: memory.external,
          arrayBuffers: memory.arrayBuffers || 0,
        },
        cpuLoad,
        // Since the main backend doesn't track global request counts the way the admin backend does, we provide 0 to satisfy the dashboard interface.
        activeRequests: 0,
        totalRequests: 0,
        totalErrors: 0,
        endpointCount: 0,
      }
    });
  } catch (error) {
    console.error('Error fetching live metrics:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch metrics' });
  }
});

/**
 * Internal route to fetch historical telemetry for a specific date
 */
router.get('/history', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD)' });
    }

    // Parse date boundaries for DAU (Daily Active Users)
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Fetch metrics from DailyServiceMetric
    const metrics = await DailyServiceMetric.find({ date });
    
    // Format into a map
    const formattedData: Record<string, { requests: number; errors: number; totalLatencyMs: number }> = {};
    metrics.forEach(m => {
      formattedData[m.serviceId] = {
        requests: m.requests,
        errors: m.errors,
        totalLatencyMs: m.totalLatencyMs,
      };
    });

    // Calculate Daily Active Users (DAU) based on lastActiveAt
    const dauCount = await User.countDocuments({
      lastActiveAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    return res.json({
      success: true,
      data: formattedData,
      system: {
        service: 'main-backend',
        activeUsers: dauCount, // In historical context, this represents DAU
        date,
      }
    });
  } catch (error) {
    console.error('Error fetching historical metrics:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch historical metrics' });
  }
});

export const internalTelemetryRoutes = router;
