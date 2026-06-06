type CounterName =
  | 'uploads.started'
  | 'uploads.failed'
  | 'uploads.completed'
  | 'uploads.low_quality'
  | 'queue.latency.ms'
  | 'queue.analysis_time.ms'
  | 'analysis.completed'
  | 'analysis.failed'
  | 'analysis.retry_required'
  | 'alignment.failure_rate'
  | 'asr.confidence'
  | 'asr.retry_frequency'
  | 'upload.size.bytes'
  | 'upload.duration.ms'
  | 'upload.memory.before.mb'
  | 'upload.memory.after.mb'
  | 'upload.memory.peak.mb';

class PronunciationMetricsService {
  private counters = new Map<CounterName, number>();

  increment(name: CounterName, value = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  observe(name: CounterName, value: number) {
    this.increment(name, value);
  }

  snapshot() {
    return Object.fromEntries(this.counters.entries());
  }
}

export const pronunciationMetrics = new PronunciationMetricsService();
