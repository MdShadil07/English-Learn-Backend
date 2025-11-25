import { Request, Response, NextFunction } from 'express'
import { redisCache } from '../config/redis.js'

/*
  Records per-route request durations and status codes.
  For each route key (method + path), keeps a circular buffer of recent durations
  to compute avg, p50, p95 and error counts.
*/

const SAMPLE_SIZE = 500 // keep last 500 samples per route

type RouteStats = {
  samples: number[]
  idx: number
  total: number
  count: number
  errors: number
}

class RouteMetrics {
  private map = new Map<string, RouteStats>()

  middleware = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint()
    // when response finishes, record
    res.on('finish', () => {
      try {
        const ms = Number((process.hrtime.bigint() - start) / BigInt(1000000))
        // Build the full route key including baseUrl for router-mounted paths
        const routePath = req.route ? req.route.path : req.path
        const base = (req as any).baseUrl || ''
        const key = `${req.method} ${base}${routePath}`
        let st = this.map.get(key)
        if (!st) {
          st = { samples: Array(SAMPLE_SIZE).fill(0), idx: 0, total: 0, count: 0, errors: 0 }
          this.map.set(key, st)
        }
        // write sample
        st.total = (st.total || 0) - (st.samples[st.idx] || 0) + ms
        st.samples[st.idx] = ms
        st.idx = (st.idx + 1) % SAMPLE_SIZE
        st.count = Math.min(st.count + 1, SAMPLE_SIZE)
        if (res.statusCode >= 500) st.errors = (st.errors || 0) + 1
      } catch (e) {
        // ignore
      }
    })
    next()
  }

  getStats() {
    const out: any[] = []
    for (const [key, st] of this.map.entries()) {
      const arr = st.samples.slice(0, st.count)
      const sorted = [...arr].sort((a, b) => a - b)
      const avg = st.count ? Math.round(st.total / st.count) : 0
      const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0
      const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0
      out.push({ route: key, avg, p50, p95, count: st.count, errors: st.errors || 0, samples: arr })
    }
    // sort by count desc
    out.sort((a, b) => b.count - a.count)
    return out
  }

  // persist summarized route stats to Redis for cross-worker aggregation
  async persistToRedis(ttl = 300) {
    try {
      const stats = this.getStats().map((r: any) => ({ route: r.route, avg: r.avg, p50: r.p50, p95: r.p95, count: r.count, errors: r.errors }))
      await redisCache.setJSON('monitor:routes', stats, ttl)
    } catch (e) {
      // ignore Redis errors
    }
  }
}

const routeMetrics = new RouteMetrics()
export default routeMetrics
