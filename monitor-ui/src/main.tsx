import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

type Counts = {
  recentSignups: number
  recentLogins: number
}

function Sparkline({ values, color = '#2563eb' }: { values: number[]; color?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const DPR = window.devicePixelRatio || 1
    const w = canvas.width = 240 * DPR
    const h = canvas.height = 64 * DPR
    canvas.style.width = '240px'
    canvas.style.height = '64px'
    ctx.scale(DPR, DPR)
    ctx.clearRect(0, 0, 240, 64)
    if (!values || values.length === 0) return
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const range = max - min || 1
    ctx.beginPath()
    values.forEach((v, i) => {
      const x = (i / (values.length - 1 || 1)) * 240
      const y = 64 - ((v - min) / range) * 64
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
  }, [values, color])

  return <canvas ref={ref} style={{ display: 'block', borderRadius: 4 }} />
}

function metricCard(title: string, value: React.ReactNode, small?: React.ReactNode) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: 'white', boxShadow: '0 4px 12px rgba(22, 23, 24, 0.04)' }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
      {small && <div style={{ marginTop: 6, fontSize: 12, color: '#9ca3af' }}>{small}</div>}
    </div>
  )
}

function App() {
  const [connected, setConnected] = useState(false)
  const [counts, setCounts] = useState<Counts>({ recentSignups: 0, recentLogins: 0 })
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem('monitor_api_key')
    } catch (e) {
      return null
    }
  })

  // performance data
  const [latencyHistory, setLatencyHistory] = useState<number[]>([])
  const [healthStatus, setHealthStatus] = useState<{ ok: boolean; status?: number; body?: any } | null>(null)
  const [metricsText, setMetricsText] = useState<string | null>(null)
  // system realtime data
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memHistory, setMemHistory] = useState<number[]>([])
  const [rpsHistory, setRpsHistory] = useState<number[]>([])
  const [routeStats, setRouteStats] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])

  // UI state
  const [polling, setPolling] = useState(true)
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(() => {
    const v = localStorage.getItem('monitor_poll_interval')
    return v ? Number(v) : 5000
  })

  const [signupHistory, setSignupHistory] = useState<number[]>([])
  const [loginHistory, setLoginHistory] = useState<number[]>([])

  // load tester
  const [loadRequests, setLoadRequests] = useState<number>(50)
  const [loadConcurrency, setLoadConcurrency] = useState<number>(10)
  const [loadTarget, setLoadTarget] = useState<string>('/health')
  const [loadRunning, setLoadRunning] = useState(false)
  const [loadResult, setLoadResult] = useState<{ success: number; fail: number; avgMs?: number } | null>(null)

  // persistence: saved runs
  const [savedRuns, setSavedRuns] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('monitor_saved_runs') || '[]') } catch(e) { return [] }
  })

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const keyFromQuery = params.get('api_key')
      if (keyFromQuery) {
        localStorage.setItem('monitor_api_key', keyFromQuery)
        setApiKey(keyFromQuery)
      }
    } catch (e) {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!apiKey) return
    const streamUrl = `/monitor/stream?api_key=${encodeURIComponent(apiKey)}`
    const es = new EventSource(streamUrl)
    es.onopen = () => setConnected(true)
    es.onmessage = (ev) => {
      setLastEvent(ev.data)
      try {
        const parsed = JSON.parse(ev.data)
        if (parsed && parsed.counts) setCounts(parsed.counts)
      } catch (e) {
        // ignore
      }
    }
    es.onerror = () => setConnected(false)

    return () => es.close()
  }, [apiKey])

  // Poll health + metrics periodically
  useEffect(() => {
    let mounted = true
    let timer: any

    const pollOnce = async () => {
      const start = performance.now()
      try {
        const res = await fetch('/health')
        const ms = Math.round(performance.now() - start)
        const body = await res.text()
        if (!mounted) return
        setHealthStatus({ ok: res.ok, status: res.status, body })
        setLatencyHistory(h => {
          const arr = [...h, ms].slice(-60)
          return arr
        })
        // also fetch /metrics (prometheus text) for display
        try {
          const m = await fetch('/metrics')
          if (m.ok) {
            const t = await m.text()
            setMetricsText(t)
          }
        } catch (e) {
          // ignore
        }
        // fetch realtime snapshot (cpu, memory, rps). We rely on cookie auth or saved key header.
        try {
          const rr = await fetch('/monitor/realtime')
          if (rr.ok) {
            const snap = await rr.json()
            // push latest cpu (use loadAvg[0]) and memory percent
            const cpuVal = (snap.system && snap.system.loadAvg && snap.system.loadAvg[0]) ? snap.system.loadAvg[0] : 0
            const memUsed = snap.process ? snap.process.memory.heapUsed / (snap.system.totalMemory || (1024*1024*1024)) * 100 : 0
            const rps = snap.requests && snap.requests.rps ? snap.requests.rps : 0
            setCpuHistory(h => [...h, cpuVal].slice(-60))
            setMemHistory(h => [...h, Math.round(memUsed)].slice(-60))
            setRpsHistory(h => [...h, Math.round(rps * 100) / 100].slice(-60))
            // if routes present, update routeStats state
            if (snap.routes) {
              setRouteStats(snap.routes)
            }
          }
        } catch (e) {
          // ignore
        }
      } catch (err) {
        if (!mounted) return
        setHealthStatus({ ok: false })
      }
    }

    if (polling) {
      pollOnce()
      timer = setInterval(pollOnce, pollIntervalMs)
    }

    return () => {
      mounted = false
      if (timer) clearInterval(timer)
    }
  }, [polling, pollIntervalMs])

  // manual refresh of route list from server
  const refreshRoutesFromServer = async () => {
    try {
      const r = await fetch('/monitor/routes')
      if (!r.ok) return
      const j = await r.json()
      if (j && j.routes) {
        setRouteStats(j.routes)
        if (!loadTarget && j.routes.length) setLoadTarget(j.routes[0].route)
      }
    } catch (e) {}
  }

  const refreshRules = async () => {
    try {
      const r = await fetch('/monitor/alerts/rules')
      if (!r.ok) return
      const j = await r.json()
      setRules(j || [])
    } catch (e) {}
  }

  // update small histories for counts
  useEffect(() => {
    setSignupHistory((x) => {
      const arr = [...x, counts.recentSignups]
      return arr.slice(-30)
    })
    setLoginHistory((x) => {
      const arr = [...x, counts.recentLogins]
      return arr.slice(-30)
    })
  }, [counts.recentSignups, counts.recentLogins])

  const saveKey = (key?: string) => {
    if (key) {
      localStorage.setItem('monitor_api_key', key)
      try { document.cookie = 'monitor_api_key=' + encodeURIComponent(key) + '; path=/'; } catch(e){}
      setApiKey(key)
    } else {
      localStorage.removeItem('monitor_api_key')
      try { document.cookie = 'monitor_api_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'; } catch(e){}
      setApiKey(null)
    }
  }

  const runLoadTest = async () => {
    setLoadRunning(true)
    setLoadResult(null)
    const total = loadRequests
    const concurrency = Math.max(1, loadConcurrency)
    let success = 0
    let fail = 0
    const timings: number[] = []

    const target = loadTarget || '/health'
    const worker = async (count: number) => {
      for (let i = 0; i < count; i++) {
        const start = Date.now()
        try {
          const headers: any = {}
          try { const k = localStorage.getItem('monitor_api_key'); if (k) headers['x-monitor-api-key'] = k } catch(e){}
          const res = await fetch(target, { method: 'GET', headers })
          if (res.ok) success++
          else fail++
        } catch (e) {
          fail++
        } finally {
          timings.push(Date.now() - start)
        }
      }
    }

    const per = Math.ceil(total / concurrency)
    const promises = [] as Promise<void>[]
    for (let i = 0; i < concurrency; i++) {
      promises.push(worker(per))
    }
    const t0 = Date.now()
    await Promise.all(promises)
    const t1 = Date.now()

    const avg = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : undefined
    const run = { timestamp: new Date().toISOString(), total, concurrency, success, fail, avgMs: avg, durationMs: t1 - t0 }
    setLoadResult({ success, fail, avgMs: avg })
    // persist run
    const next = [run, ...savedRuns].slice(0, 50)
    setSavedRuns(next)
    try { localStorage.setItem('monitor_saved_runs', JSON.stringify(next)) } catch (e) {}
    setLoadRunning(false)
  }

  const exportSaved = () => {
    const data = JSON.stringify(savedRuns, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monitor-runs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 20, background: '#f3f4f6', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>EnglishLearn — Monitoring</h1>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Realtime health, performance and load testing</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>SSE: {connected ? 'connected' : 'disconnected'}</div>
          <input style={{ padding: 6, borderRadius: 6 }} defaultValue={apiKey ?? ''} onBlur={(e) => saveKey(e.currentTarget.value || undefined)} placeholder="API key" />
        </div>
      </header>

      <main>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {metricCard('Recent Signups', <span style={{ color: '#111' }}>{counts.recentSignups}</span>, 'Last hour')}
          {metricCard('Recent Logins', <span style={{ color: '#111' }}>{counts.recentLogins}</span>, 'Realtime counter')}
          {metricCard('Request Rate (RPS)', <span style={{ color: '#111' }}>{rpsHistory.length ? rpsHistory[rpsHistory.length-1] : 0}</span>, 'Requests/sec (last 60s)')}
          {metricCard('CPU Load (1m)', <span style={{ color: '#111' }}>{cpuHistory.length ? cpuHistory[cpuHistory.length-1] : 0}</span>, 'System 1m load average')}
        </div>

        <section style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div style={{ background: 'white', padding: 12, borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Latency (ms)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Latency (ms)</div>
                <Sparkline values={latencyHistory} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>CPU (1m load)</div>
                <Sparkline values={cpuHistory} color="#f59e0b" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Memory %</div>
                <Sparkline values={memHistory} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>RPS</div>
                <Sparkline values={rpsHistory} color="#2563eb" />
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
              <div>Avg Latency: {latencyHistory.length ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) : '-'} ms</div>
              <div>Max Latency: {latencyHistory.length ? Math.max(...latencyHistory) : '-'} ms</div>
              <div>Avg RPS: {rpsHistory.length ? rpsHistory[rpsHistory.length-1] : '-'}</div>
            </div>
            <h4 style={{ marginTop: 12 }}>Metrics (Prometheus)</h4>
            <pre style={{ maxHeight: 220, overflow: 'auto', background: '#f8fafc', padding: 8 }}>{metricsText ?? 'No metrics available'}</pre>
          </div>

          <div style={{ background: 'white', padding: 12, borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Load Tester</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 13 }}>Requests:</label>
              <input type="number" value={loadRequests} onChange={(e) => setLoadRequests(Number(e.target.value))} style={{ width: 80 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <label style={{ fontSize: 13 }}>Concurrency:</label>
              <input type="number" value={loadConcurrency} onChange={(e) => setLoadConcurrency(Number(e.target.value))} style={{ width: 80 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <label style={{ fontSize: 13 }}>Target Path:</label>
              <input type="text" value={loadTarget} onChange={(e) => setLoadTarget(e.target.value)} style={{ width: 220 }} placeholder="/health or /api/auth/login" />
              <select style={{ marginLeft: 8 }} onChange={(e) => setLoadTarget(e.target.value)} value={loadTarget}>
                <option value="/health">/health</option>
                <option value="/metrics">/metrics</option>
                {routeStats.map((r:any, idx:number) => (
                  <option key={idx} value={r.route}>{r.route}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={runLoadTest} disabled={loadRunning} style={{ padding: '8px 12px', background: '#2563eb', color: 'white', border: 0, borderRadius: 6 }}>{loadRunning ? 'Running...' : 'Run Test'}</button>
              <button onClick={refreshRoutesFromServer} style={{ marginLeft: 8, padding: '8px 12px', background: '#111827', color: 'white', border: 0, borderRadius: 6 }}>Refresh routes</button>
            </div>
            {loadResult && (
              <div style={{ marginTop: 12 }}>
                <div>Success: {loadResult.success}</div>
                <div>Fail: {loadResult.fail}</div>
                <div>Avg ms: {loadResult.avgMs}</div>
              </div>
            )}

            <h4 style={{ marginTop: 12 }}>Saved Runs</h4>
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}><th>Time</th><th>Total</th><th>Concurrency</th><th>OK</th><th>Fail</th><th>Avg ms</th></tr>
                </thead>
                <tbody>
                  {savedRuns.map((r, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #eef2f7' }}>
                      <td style={{ padding: 6, fontSize: 13 }}>{new Date(r.timestamp).toLocaleString()}</td>
                      <td style={{ padding: 6 }}>{r.total}</td>
                      <td style={{ padding: 6 }}>{r.concurrency}</td>
                      <td style={{ padding: 6 }}>{r.success}</td>
                      <td style={{ padding: 6 }}>{r.fail}</td>
                      <td style={{ padding: 6 }}>{r.avgMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={exportSaved} style={{ padding: '8px 12px', background: '#111827', color: 'white', border: 0, borderRadius: 6 }}>Export</button>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 12 }}>
          <h3>Realtime Events</h3>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'white', padding: 12, borderRadius: 8 }}>{lastEvent ?? 'No events yet'}</pre>
        </section>

        <section style={{ marginTop: 12 }}>
          <h3>Per-Route Performance</h3>
          <div style={{ background: 'white', padding: 12, borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}><th>Route</th><th>Count</th><th>Avg(ms)</th><th>P50</th><th>P95</th><th>Errors</th></tr>
              </thead>
              <tbody>
                {routeStats.map((r: any, idx: number) => (
                  <tr key={idx} style={{ borderTop: '1px solid #eef2f7' }}>
                    <td style={{ padding: 6, fontSize: 13 }}>{r.route}</td>
                    <td style={{ padding: 6 }}>{r.count}</td>
                    <td style={{ padding: 6 }}>{r.avg}</td>
                    <td style={{ padding: 6 }}>{r.p50}</td>
                    <td style={{ padding: 6 }}>{r.p95}</td>
                    <td style={{ padding: 6 }}>{r.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <small style={{ color: '#6b7280' }}>Showing recent samples (up to 500 per route). Use this to find slow or error-prone endpoints.</small>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 12 }}>
          <h3>Alerts & Rules</h3>
          <div style={{ background: 'white', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={async () => { const r = await fetch('/monitor/alerts'); if (r.ok) { const j = await r.json(); alert('Active alerts:\n' + JSON.stringify(j, null, 2)) } }} style={{ padding: '6px 10px' }}>Show Active Alerts</button>
              <button onClick={async () => { const r = await fetch('/monitor/alerts/history'); if (r.ok) { const j = await r.json(); alert('Alert history:\n' + JSON.stringify(j.slice(0,50), null, 2)) } }} style={{ padding: '6px 10px' }}>Show Alert History</button>
              <button onClick={async () => { const r = await fetch('/monitor/alerts/rules'); if (r.ok) { const j = await r.json(); alert('Rules:\n' + JSON.stringify(j, null, 2)) } }} style={{ padding: '6px 10px' }}>List Rules</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <h4 style={{ margin: '8px 0' }}>Create Rule</h4>
              <CreateRuleForm onCreated={async () => { try { await refreshRules(); alert('Rule saved'); } catch(e){} }} />
            </div>

          </div>
        </section>
      </main>
    </div>
  )
}

function CreateRuleForm({ onCreated }: { onCreated?: () => void }) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'route_p95' | 'rps' | 'memory'>('route_p95')
  const [route, setRoute] = useState('')
  const [threshold, setThreshold] = useState<number>(500)

  const submit = async () => {
    try {
      const body: any = { id: id || String(Date.now()), name: name || id || 'rule', type, threshold }
      if (type === 'route_p95') body.route = route
      const r = await fetch('/monitor/alerts/rules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        setId(''); setName(''); setRoute(''); setThreshold(500)
        onCreated && onCreated()
      } else {
        const t = await r.text()
        alert('Failed: ' + t)
      }
    } catch (e) { alert('Error creating rule') }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
      <input placeholder="id" value={id} onChange={e => setId(e.target.value)} />
      <input placeholder="name" value={name} onChange={e => setName(e.target.value)} />
      <select value={type} onChange={e => setType(e.target.value as any)}>
        <option value="route_p95">Route p95</option>
        <option value="rps">RPS</option>
        <option value="memory">Memory %</option>
      </select>
      <input placeholder="route (for route_p95)" value={route} onChange={e => setRoute(e.target.value)} />
      <input placeholder="threshold" type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
      <div />
      <button onClick={submit} style={{ padding: '6px 10px' }}>Create</button>
    </div>
  )
}

const container = document.getElementById('monitor-root')
if (container) {
  createRoot(container).render(React.createElement(App))
}
