import os from 'os';
import { redisCache } from '../config/redis.js';
import cluster from 'cluster';

export interface SystemMetrics {
  cpuUsage: number;
  memoryRss: number;
  memoryHeapUsed: number;
  memoryHeapTotal: number;
  memoryExternal: number;
  uptime: number;
  pid: number;
  nodeVersion: string;
  eventLoopLag: number;
  activeRequests: number;
  activeHandles: number;
  activeRequestsCount: number;
  timestamp: number;
}

export interface RequestMetrics {
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp: number;
}

export interface PronunciationMetrics {
  stage: 'transcription' | 'alignment' | 'acoustic' | 'scoring' | 'total';
  durationMs: number;
  memoryBeforeRss: number;
  memoryAfterRss: number;
  memoryBeforeHeap: number;
  memoryAfterHeap: number;
  cpuBefore: NodeJS.CpuUsage;
  cpuAfter: NodeJS.CpuUsage;
  timestamp: number;
}

export interface ServiceStateMetrics {
  service: string;
  metrics: Record<string, number>;
  timestamp: number;
}

class MetricsPublisher {
  private requestBuffer: RequestMetrics[] = [];
  private pronunciationBuffer: PronunciationMetrics[] = [];
  private serviceStateBuffer: ServiceStateMetrics[] = [];
  private lastEventLoopTime: number = Date.now();
  private currentLag: number = 0;
  private flushIntervalMs = 10000; // 10 seconds
  private intervalTimer: NodeJS.Timeout | null = null;
  private readonly METRICS_TTL = 86400; // 24 hours in seconds
  private lastCpuUsage: NodeJS.CpuUsage = process.cpuUsage();
  private lastCpuTime: [number, number] = process.hrtime();

  constructor() {
    this.startLagMonitor();
  }

  public start() {
    if (!this.intervalTimer) {
      this.intervalTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    }
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private startLagMonitor() {
    const monitor = () => {
      const now = Date.now();
      this.currentLag = Math.max(0, now - this.lastEventLoopTime - 500);
      this.lastEventLoopTime = now;
      setTimeout(monitor, 500).unref();
    };
    monitor();
  }

  public trackRequest(req: RequestMetrics) {
    this.requestBuffer.push(req);
    // Safety limit
    if (this.requestBuffer.length > 5000) this.requestBuffer.shift();
  }

  public trackPronunciation(stage: string, durationMs: number, memBefore: { rss: number; heapUsed: number }, memAfter: { rss: number; heapUsed: number }, cpuBefore: NodeJS.CpuUsage, cpuAfter: NodeJS.CpuUsage) {
    this.pronunciationBuffer.push({
      stage: stage as any,
      durationMs,
      memoryBeforeRss: memBefore.rss,
      memoryAfterRss: memAfter.rss,
      memoryBeforeHeap: memBefore.heapUsed,
      memoryAfterHeap: memAfter.heapUsed,
      cpuBefore,
      cpuAfter,
      timestamp: Date.now()
    });
    if (this.pronunciationBuffer.length > 1000) this.pronunciationBuffer.shift();
  }

  public trackServiceState(service: string, metrics: Record<string, number>) {
    this.serviceStateBuffer.push({
      service,
      metrics,
      timestamp: Date.now()
    });
    if (this.serviceStateBuffer.length > 1000) this.serviceStateBuffer.shift();
  }

  private async flush() {
    const client = redisCache.getClient();
    if (!client || !redisCache.isConnected()) return;

    try {
      const pipeline = client.pipeline();
      const now = Date.now();
      
      // Calculate interval-based CPU usage fraction scaled by number of CPUs
      const currentCpuUsage = process.cpuUsage();
      const currentCpuTime = process.hrtime();
      
      const cpuUsageDiff = {
        user: currentCpuUsage.user - this.lastCpuUsage.user,
        system: currentCpuUsage.system - this.lastCpuUsage.system
      };
      
      const elapsedMicros = (currentCpuTime[0] - this.lastCpuTime[0]) * 1e6 + (currentCpuTime[1] - this.lastCpuTime[1]) / 1e3;
      const totalCpuMicros = cpuUsageDiff.user + cpuUsageDiff.system;
      const numCpus = os.cpus().length || 1;
      
      const cpuUsageFraction = elapsedMicros > 0 ? (totalCpuMicros / elapsedMicros) / numCpus : 0;
      
      this.lastCpuUsage = currentCpuUsage;
      this.lastCpuTime = currentCpuTime;
      
      // 1. System Metrics
      const mem = process.memoryUsage();
      const isWorker = cluster.isWorker ? `worker-${process.pid}` : 'master';
      const sysKey = `monitoring:system:${isWorker}`;

      const activeHandles = (process as any)._getActiveHandles ? (process as any)._getActiveHandles().length : 0;
      const activeReqs = (process as any)._getActiveRequests ? (process as any)._getActiveRequests().length : 0;

      const systemMetrics: SystemMetrics = {
        cpuUsage: cpuUsageFraction,
        memoryRss: mem.rss,
        memoryHeapUsed: mem.heapUsed,
        memoryHeapTotal: mem.heapTotal,
        memoryExternal: mem.external,
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version,
        eventLoopLag: this.currentLag,
        activeHandles,
        activeRequests: activeReqs,
        activeRequestsCount: activeReqs,
        timestamp: now
      };
      
      pipeline.zadd(sysKey, now, JSON.stringify(systemMetrics));
      // Keep only last 24h
      pipeline.zremrangebyscore(sysKey, '-inf', now - (24 * 60 * 60 * 1000));
      pipeline.expire(sysKey, this.METRICS_TTL);

      // 2. Request Metrics
      if (this.requestBuffer.length > 0) {
        const reqs = [...this.requestBuffer];
        this.requestBuffer = [];
        
        for (const req of reqs) {
          const reqKey = `monitoring:requests:${req.route}:${req.method}`;
          pipeline.zadd(reqKey, req.timestamp, JSON.stringify(req));
          pipeline.zremrangebyscore(reqKey, '-inf', now - (24 * 60 * 60 * 1000));
          pipeline.expire(reqKey, this.METRICS_TTL);
        }
      }

      // 3. Pronunciation Metrics
      if (this.pronunciationBuffer.length > 0) {
        const prons = [...this.pronunciationBuffer];
        this.pronunciationBuffer = [];
        
        for (const p of prons) {
          const pKey = `monitoring:pronunciation:${p.stage}`;
          pipeline.zadd(pKey, p.timestamp, JSON.stringify(p));
          pipeline.zremrangebyscore(pKey, '-inf', now - (24 * 60 * 60 * 1000));
          pipeline.expire(pKey, this.METRICS_TTL);
        }
      }
      
      // 4. Service State Metrics
      if (this.serviceStateBuffer.length > 0) {
        const states = [...this.serviceStateBuffer];
        this.serviceStateBuffer = [];
        
        for (const s of states) {
          const sKey = `monitoring:state:${s.service}`;
          pipeline.zadd(sKey, s.timestamp, JSON.stringify(s));
          pipeline.zremrangebyscore(sKey, '-inf', now - (24 * 60 * 60 * 1000));
          pipeline.expire(sKey, this.METRICS_TTL);
        }
      }

      await pipeline.exec();
    } catch (err) {
      console.error('[MetricsPublisher] Failed to flush metrics:', err);
    }
  }
}

export const metricsPublisher = new MetricsPublisher();
