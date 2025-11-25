import express from 'express';
import { redisCache } from '../../config/redis.js';
import { AccuracyCachingService } from '../../services/Cache/accuracyCachingService.js';

const router = express.Router();

/**
 * GET /api/admin/cache-stats
 * Get comprehensive cache statistics
 */
router.get('/cache-stats', async (req, res) => {
  try {
    // Get accuracy cache stats
    const accuracyStats = await AccuracyCachingService.getCacheStats();

    // Get Redis client
    const client = redisCache.getClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        message: 'Redis client not available'
      });
    }

    // Get overall Redis stats
    const info = await client.info('stats');
    const keyspaceInfo = await client.info('keyspace');
    
    // Parse Redis info
    const parseInfo = (infoString: string) => {
      const lines = infoString.split('\r\n');
      const stats: Record<string, string> = {};
      lines.forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            stats[key] = value;
          }
        }
      });
      return stats;
    };

    const redisStats = parseInfo(info);
    const keyspaceStats = parseInfo(keyspaceInfo);

    // Get all keys and categorize them
    const allKeys = await client.keys('*');
    const categorizedKeys: Record<string, number> = {
      accuracy: 0,
      streak: 0,
      progress: 0,
      leaderboard: 0,
      session: 0,
      other: 0
    };

    allKeys.forEach((key: string) => {
      if (key.startsWith('accuracy:')) categorizedKeys.accuracy++;
      else if (key.startsWith('streak:')) categorizedKeys.streak++;
      else if (key.startsWith('progress:')) categorizedKeys.progress++;
      else if (key.startsWith('leaderboard:')) categorizedKeys.leaderboard++;
      else if (key.startsWith('session:')) categorizedKeys.session++;
      else categorizedKeys.other++;
    });

    // Calculate cache hit rate (if available)
    const hits = parseInt(redisStats.keyspace_hits || '0');
    const misses = parseInt(redisStats.keyspace_misses || '0');
    const totalRequests = hits + misses;
    const hitRate = totalRequests > 0 ? ((hits / totalRequests) * 100).toFixed(2) : '0.00';

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        // Overall Redis stats
        redis: {
          totalKeys: allKeys.length,
          keyspaceHits: hits,
          keyspaceMisses: misses,
          hitRate: `${hitRate}%`,
          connectedClients: parseInt(redisStats.connected_clients || '0'),
          totalConnections: parseInt(redisStats.total_connections_received || '0'),
          totalCommands: parseInt(redisStats.total_commands_processed || '0'),
          usedMemory: redisStats.used_memory_human || 'N/A'
        },

        // Key breakdown by category
        keys: categorizedKeys,

        // Accuracy cache specific stats
        accuracy: accuracyStats,

        // Performance metrics
        performance: {
          estimatedCacheHitRate: `${hitRate}%`,
          totalCachedItems: allKeys.length,
          cacheEfficiency: totalRequests > 0 ? 'Active' : 'Idle',
          recommendedAction: 
            parseFloat(hitRate) < 70 ? 'Consider increasing TTLs or cache warmup' :
            parseFloat(hitRate) > 90 ? 'Excellent - cache working optimally' :
            'Good - cache performing well'
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching cache stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cache statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/cache/clear
 * Clear specific cache categories
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category required (accuracy, streak, progress, leaderboard, all)'
      });
    }

    let pattern: string;
    switch (category) {
      case 'accuracy':
        pattern = 'accuracy:*';
        break;
      case 'streak':
        pattern = 'streak:*';
        break;
      case 'progress':
        pattern = 'progress:*';
        break;
      case 'leaderboard':
        pattern = 'leaderboard:*';
        break;
      case 'all':
        pattern = '*';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid category. Use: accuracy, streak, progress, leaderboard, or all'
        });
    }

    const client = redisCache.getClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        message: 'Redis client not available'
      });
    }

    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }

    return res.json({
      success: true,
      message: `Cleared ${keys.length} keys from ${category} cache`,
      cleared: keys.length
    });
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/cache/warmup
 * Warm up cache for specific user
 */
router.post('/cache/warmup', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId required'
      });
    }

    // Warm up accuracy cache
    await AccuracyCachingService.warmUpCache(userId);

    return res.json({
      success: true,
      message: `Cache warmed up for user ${userId}`,
      userId
    });
  } catch (error) {
    console.error('❌ Error warming up cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to warm up cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/health
 * Comprehensive health check including cache status
 */
router.get('/health', async (req, res) => {
  try {
    const mongoConnected = (await import('../../config/database.js')).database.isConnected();
    const redisConnected = redisCache.isConnected();

    // Test Redis connection
    let redisPing = false;
    try {
      const client = redisCache.getClient();
      if (client) {
        const result = await client.ping();
        redisPing = result === 'PONG';
      }
    } catch (err) {
      redisPing = false;
    }

    const allHealthy = mongoConnected && redisConnected && redisPing;

    return res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoConnected ? 'healthy' : 'unhealthy',
        redis: redisConnected && redisPing ? 'healthy' : 'unhealthy',
        cache: redisPing ? 'operational' : 'degraded'
      },
      status: allHealthy ? 'All systems operational' : 'Some services degraded'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
