// DailyServiceMetric is now managed by the admin backend.
// We just forward our telemetry there.
interface MetricBuffer {
  requests: number;
  errors: number;
  totalLatencyMs: number;
}

class TelemetryService {
  private buffer: Map<string, MetricBuffer> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds

  constructor() {
    this.startFlushInterval();
  }

  private startFlushInterval() {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  /**
   * Record a call to an external service.
   * @param serviceId 'supabase', 'aws-s3', 'unified-accuracy', 'whisper', 'mfa', 'languagetool', 'pronunciation'
   * @param latencyMs Duration of the call in milliseconds
   * @param isError True if the call failed
   */
  public recordServiceCall(serviceId: string, latencyMs: number, isError: boolean = false) {
    if (!this.buffer.has(serviceId)) {
      this.buffer.set(serviceId, { requests: 0, errors: 0, totalLatencyMs: 0 });
    }

    const current = this.buffer.get(serviceId)!;
    current.requests += 1;
    if (isError) current.errors += 1;
    current.totalLatencyMs += latencyMs;
  }

  /**
   * Returns today's date in YYYY-MM-DD format based on local time
   */
  private getTodayDateString(): string {
    const d = new Date();
    // Use local date (or could use UTC if preferred)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Flushes the in-memory buffer to MongoDB
   */
  private async flush() {
    if (this.buffer.size === 0) return;

    const dateStr = this.getTodayDateString();
    
    // Copy the buffer to allow new requests to accumulate while we save
    const currentBuffer = new Map(this.buffer);
    this.buffer.clear();

    const metrics = Array.from(currentBuffer.entries()).map(([serviceId, data]) => ({
      serviceId,
      requests: data.requests,
      errors: data.errors,
      totalLatencyMs: data.totalLatencyMs
    }));

    try {
      if (metrics.length > 0) {
        const adminUrl = process.env.ADMIN_BACKEND_URL || 'http://localhost:5200';
        const secret = process.env.ADMIN_INTERNAL_SECRET || 'internal-secret';
        
        await fetch(`${adminUrl}/api/admin/metrics/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`
          },
          body: JSON.stringify({ metrics, date: dateStr }),
          // Fire and forget with short timeout to avoid blocking if admin is down
          signal: AbortSignal.timeout(2000)
        });
      }
    } catch (err) {
      console.error('[TelemetryService] Failed to flush metrics to Admin Backend:', err);
      // Re-add to buffer to retry next flush
      for (const [serviceId, data] of currentBuffer.entries()) {
        const existing = this.buffer.get(serviceId) || { requests: 0, errors: 0, totalLatencyMs: 0 };
        this.buffer.set(serviceId, {
          requests: existing.requests + data.requests,
          errors: existing.errors + data.errors,
          totalLatencyMs: existing.totalLatencyMs + data.totalLatencyMs
        });
      }
    }
  }

  /**
   * Used by the Admin backend to fetch today's aggregated stats
   */
  public getLiveTodayMetrics() {
    const results: Record<string, { requests: number; errors: number; totalLatencyMs: number }> = {};
    
    // Only return the current unflushed buffer. The admin backend has the flushed historical DB data.
    for (const [serviceId, data] of this.buffer.entries()) {
      results[serviceId] = { 
        requests: data.requests, 
        errors: data.errors, 
        totalLatencyMs: data.totalLatencyMs 
      };
    }

    return results;
  }
}

export const telemetryService = new TelemetryService();
