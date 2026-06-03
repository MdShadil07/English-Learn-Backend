import { redisCache } from '../../config/redis.js';

export interface ClientQualityMetric {
  roomId: string;
  userId: string;
  quality: string;
  jitterMs?: number;
  packetLossPercent?: number;
  rttMs?: number;
  timestamp: string;
}

class RoomMetricsService {
  private readonly inMemoryByRoom = new Map<string, ClientQualityMetric[]>();
  private readonly perRoomLimit = Number(process.env.ROOM_METRICS_PER_ROOM_LIMIT || 400);
  private readonly metricsTtlSeconds = Number(process.env.ROOM_METRICS_TTL_SECONDS || 60 * 60 * 6);

  private key(roomId: string): string {
    return `room:metrics:${roomId}`;
  }

  async recordClientQuality(metric: ClientQualityMetric): Promise<void> {
    const current = this.inMemoryByRoom.get(metric.roomId) || [];
    current.push(metric);
    if (current.length > this.perRoomLimit) {
      current.splice(0, current.length - this.perRoomLimit);
    }
    this.inMemoryByRoom.set(metric.roomId, current);

    if (!redisCache.isConnected()) return;

    try {
      const client = redisCache.getClient();
      if (!client) return;

      const payload = JSON.stringify(metric);
      await client.multi()
        .lpush(this.key(metric.roomId), payload)
        .ltrim(this.key(metric.roomId), 0, this.perRoomLimit - 1)
        .expire(this.key(metric.roomId), this.metricsTtlSeconds)
        .exec();
    } catch (error) {
      console.warn('[RoomMetrics] Failed to persist metric', error);
    }
  }

  async getRoomMetrics(roomId: string, limit = 100): Promise<ClientQualityMetric[]> {
    const safeLimit = Math.max(1, Math.min(limit, this.perRoomLimit));

    if (redisCache.isConnected()) {
      try {
        const client = redisCache.getClient();
        if (client) {
          const rows = await client.lrange(this.key(roomId), 0, safeLimit - 1);
          return rows.map((row: string) => JSON.parse(row) as ClientQualityMetric);
        }
      } catch (error) {
        console.warn('[RoomMetrics] Failed to load metrics from Redis', error);
      }
    }

    const memoryRows = this.inMemoryByRoom.get(roomId) || [];
    return [...memoryRows].reverse().slice(0, safeLimit);
  }

  async getRoomMetricsSummary(roomId: string): Promise<Record<string, unknown>> {
    const metrics = await this.getRoomMetrics(roomId, 200);
    if (metrics.length === 0) {
      return {
        roomId,
        sampleSize: 0,
        qualityCounts: {},
        avgJitterMs: null,
        avgPacketLossPercent: null,
        avgRttMs: null,
      };
    }

    const qualityCounts: Record<string, number> = {};
    let jitterSum = 0;
    let jitterCount = 0;
    let packetLossSum = 0;
    let packetLossCount = 0;
    let rttSum = 0;
    let rttCount = 0;

    for (const metric of metrics) {
      qualityCounts[metric.quality] = (qualityCounts[metric.quality] || 0) + 1;
      if (typeof metric.jitterMs === 'number') {
        jitterSum += metric.jitterMs;
        jitterCount += 1;
      }
      if (typeof metric.packetLossPercent === 'number') {
        packetLossSum += metric.packetLossPercent;
        packetLossCount += 1;
      }
      if (typeof metric.rttMs === 'number') {
        rttSum += metric.rttMs;
        rttCount += 1;
      }
    }

    return {
      roomId,
      sampleSize: metrics.length,
      qualityCounts,
      avgJitterMs: jitterCount ? Number((jitterSum / jitterCount).toFixed(2)) : null,
      avgPacketLossPercent: packetLossCount ? Number((packetLossSum / packetLossCount).toFixed(2)) : null,
      avgRttMs: rttCount ? Number((rttSum / rttCount).toFixed(2)) : null,
      latestAt: metrics[0]?.timestamp || null,
    };
  }
}

export const roomMetricsService = new RoomMetricsService();
export default roomMetricsService;
