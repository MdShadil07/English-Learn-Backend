/*
  Lightweight in-memory request metrics for realtime RPS charts.
  Tracks per-second request counts in a circular buffer (last 120 seconds).
  Exported middleware increments the current second slot for each request.
  Provides getSnapshot() to retrieve array of counts and totals.
*/
import { Request, Response, NextFunction } from 'express'

const BUCKETS = 120 // keep last 120 seconds

class RequestMetrics {
  private buckets: number[] = Array(BUCKETS).fill(0)
  private startSec = Math.floor(Date.now() / 1000)

  middleware = (req: Request, res: Response, next: NextFunction) => {
    try {
      const nowSec = Math.floor(Date.now() / 1000)
      const idx = this.indexFor(nowSec)
      this.buckets[idx] = (this.buckets[idx] || 0) + 1
    } catch (e) {
      // ignore
    }
    return next()
  }

  private indexFor(sec: number) {
    const diff = sec - this.startSec
    if (diff >= BUCKETS) {
      // rotate start
      const shift = Math.floor(diff / BUCKETS) * BUCKETS
      this.startSec += shift
      // clear buckets when we jump far ahead
      this.buckets = Array(BUCKETS).fill(0)
    }
    const idx = ((sec - this.startSec) % BUCKETS + BUCKETS) % BUCKETS
    return idx
  }

  getSnapshot() {
    const nowSec = Math.floor(Date.now() / 1000)
    const arr: { ts: number; count: number }[] = []
    for (let i = 0; i < BUCKETS; i++) {
      const ts = this.startSec + i
      arr.push({ ts: ts * 1000, count: this.buckets[i] || 0 })
    }
    const total = arr.reduce((s, a) => s + a.count, 0)
    const last60 = arr.slice(-60).reduce((s, a) => s + a.count, 0)
    const rps = last60 / 60
    return { timestamp: Date.now(), buckets: arr, total, rps }
  }
}

const metrics = new RequestMetrics()
export default metrics
