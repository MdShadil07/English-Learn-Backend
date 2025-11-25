import { redisCache } from '../../config/redis.js'
import routeMetrics from '../../middleware/routeMetrics.js'
import requestMetrics from '../../middleware/requestMetrics.js'
import os from 'os'

type Rule = {
  id: string
  name: string
  type: 'route_p95' | 'rps' | 'memory'
  route?: string
  threshold: number
  durationSec?: number
}

type Alert = {
  id: string
  ruleId: string
  name: string
  triggeredAt: string
  value: any
  resolvedAt?: string
}

class AlertService {
  private rules: Rule[] = []
  private active: Map<string, Alert> = new Map()

  constructor() {
    // load rules from Redis if present
    this.loadRules().catch(()=>{})
    // start periodic evaluation
    setInterval(() => this.evaluate().catch(()=>{}), 5000)
  }

  async loadRules() {
    try {
      const data = await redisCache.getJSON<Rule[]>('monitor:rules:config')
      if (data) this.rules = data
    } catch (e) {}
  }

  async saveRules() {
    try { await redisCache.setJSON('monitor:rules:config', this.rules, 24*3600) } catch(e){}
  }

  async addRule(r: Rule) {
    this.rules.push(r)
    await this.saveRules()
    return r
  }

  async listRules() { return this.rules }

  async removeRule(id: string) {
    this.rules = this.rules.filter(r => r.id !== id)
    await this.saveRules()
  }

  // get active alerts
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const data = await redisCache.getJSON<Alert[]>('monitor:alerts:active')
      return data || Array.from(this.active.values())
    } catch (e) {
      return Array.from(this.active.values())
    }
  }

  // Return only the in-memory active alerts without hitting Redis
  getActiveAlertsLocal(): Alert[] {
    return Array.from(this.active.values())
  }

  async listHistory(): Promise<Alert[]> {
    try {
      const historyKey = 'monitor:alerts:history'
      const hist = (await redisCache.getJSON<Alert[]>(historyKey)) || []
      return hist
    } catch (e) {
      return []
    }
  }

  private async persistActive() {
    try {
      await redisCache.setJSON('monitor:alerts:active', Array.from(this.active.values()), 3600)
    } catch (e) {}
  }

  async evaluate() {
    try {
      // snapshot data
      const routes = routeMetrics.getStats()
      const reqs = requestMetrics.getSnapshot()
      const memPercent = (process.memoryUsage().heapUsed / os.totalmem()) * 100

      for (const rule of this.rules) {
        if (rule.type === 'route_p95' && rule.route) {
          const r = routes.find((x:any) => x.route === rule.route)
          if (r && r.p95 > rule.threshold) {
            const aid = `alert:${rule.id}`
            if (!this.active.has(aid)) {
              const alert = { id: aid, ruleId: rule.id, name: rule.name, triggeredAt: new Date().toISOString(), value: { p95: r.p95 } }
              this.active.set(aid, alert)
              await this.onAlert(alert)
            }
          } else {
            const aid = `alert:${rule.id}`
            if (this.active.has(aid)) { const a = this.active.get(aid)!; a.resolvedAt = new Date().toISOString(); this.active.delete(aid); await this.onResolve(a) }
          }
        }

        if (rule.type === 'rps') {
          const rps = reqs.rps || 0
          const aid = `alert:${rule.id}`
          if (rps > rule.threshold) {
            if (!this.active.has(aid)) {
              const alert = { id: aid, ruleId: rule.id, name: rule.name, triggeredAt: new Date().toISOString(), value: { rps } }
              this.active.set(aid, alert)
              await this.onAlert(alert)
            }
          } else if (this.active.has(aid)) {
            const a = this.active.get(aid)!; a.resolvedAt = new Date().toISOString(); this.active.delete(aid); await this.onResolve(a)
          }
        }

        if (rule.type === 'memory') {
          const aid = `alert:${rule.id}`
          if (memPercent > rule.threshold) {
            if (!this.active.has(aid)) {
              const alert = { id: aid, ruleId: rule.id, name: rule.name, triggeredAt: new Date().toISOString(), value: { memPercent } }
              this.active.set(aid, alert)
              await this.onAlert(alert)
            }
          } else if (this.active.has(aid)) {
            const a = this.active.get(aid)!; a.resolvedAt = new Date().toISOString(); this.active.delete(aid); await this.onResolve(a)
          }
        }
      }

      // persist active alerts
      await this.persistActive()
    } catch (e) {
      // ignore
    }
  }

  // on alert: persist and optionally call webhook (config in env)
  private async onAlert(alert: Alert) {
    try {
      // persist to Redis list for history
      const historyKey = 'monitor:alerts:history'
      const hist = (await redisCache.getJSON<any[]>(historyKey)) || []
      hist.unshift(alert)
      hist.splice(1000)
      await redisCache.setJSON(historyKey, hist, 24*3600)

      // optional webhook
      const webhook = process.env.MONITOR_ALERT_WEBHOOK
      if (webhook) {
        try { await fetch(webhook, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(alert) }) } catch(e){}
      }
    } catch (e) {}
  }

  private async onResolve(alert: Alert) {
    try { await this.persistActive() } catch(e){}
  }
}

const alertService = new AlertService()
export default alertService
