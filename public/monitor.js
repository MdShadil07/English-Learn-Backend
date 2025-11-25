(function(){
  const el = id=>document.getElementById(id);
  const env = el('env'), ver = el('ver'), uptime = el('uptime'), pid = el('pid');
  const db = el('db'), dbResp = el('dbResp'), redis = el('redis'), redisResp = el('redisResp');
  const status = el('status'), last = el('last');
  const cpuEl = el('cpu'), cores = el('cores'), loadavg = el('loadavg');
  const rss = el('rss'), heap = el('heap'), heapLimit = el('heapLimit');
  const logs = el('logs');
  const runBtn = el('runTest'), stopBtn = el('stopTest'), resPre = el('testResult');
  const endpointInp = el('testEndpoint'), requestsInp = el('testRequests'), concurrencyInp = el('testConcurrency');

  let cpuSeries = [], memSeries = [];
  const maxPoints = 40;

  // canvas helpers
  function drawLine(canvasId, series, color){
    const canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.clearRect(0,0,w,h);
    if(!series.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = 2 * devicePixelRatio; ctx.beginPath();
    series.forEach((v,i)=>{
      const x = (i/(maxPoints-1))*w; const y = h - (Math.min(1,v/100)*h);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }

  async function fetchMetrics(){
    try{
      const res = await fetch('/metrics');
      if(!res.ok) throw new Error('metrics fetch failed');
      const data = await res.json();
      // header
      env.textContent = data.environment;
      ver.textContent = data.version;
      uptime.textContent = `${Math.floor(data.uptime)}s`;
      pid.textContent = data.process.pid;

      // DB/Redis
      const dbStatus = data.database?.connected ? 'connected' : 'disconnected';
      db.textContent = dbStatus; dbResp.textContent = data.database?.responseTime ?? '-';
      redis.textContent = data.redis?.connected ? 'connected' : 'disconnected'; redisResp.textContent = '-';

      // cpu/mem
      const cpuPercent = Math.round(((data.process.cpu.user + data.process.cpu.system)/1e6)*100)/100;
      cpuEl.textContent = cpuPercent + '%'; cores.textContent = data.system.cpuCount;
      loadavg.textContent = data.system.loadAverage.map(v=>v.toFixed(2)).join(', ');
      rss.textContent = formatBytes(data.process.memory.rss);
      heap.textContent = formatBytes(data.process.memory.heapUsed);
      heapLimit.textContent = formatBytes(data.v8.heapSizeLimit || data.v8.totalAvailableSize || 0);

      // update charts
      cpuSeries.push(cpuPercent); if(cpuSeries.length>maxPoints) cpuSeries.shift();
      const heapMb = Math.round((data.process.memory.heapUsed/1024/1024)*100)/100; memSeries.push(heapMb); if(memSeries.length>maxPoints) memSeries.shift();
      drawLine('cpuChart', cpuSeries.map(v=>v), '#60a5fa');
      // normalize memSeries to 0-100 by dividing by heap limit (approx)
      const heapLimitVal = data.v8.totalHeapSize || data.v8.heapSizeLimit || (data.system.totalMemory||1);
      const normalized = memSeries.map(v=> Math.min(100, (v*1024*1024)/(heapLimitVal||1)*100));
      drawLine('memChart', normalized, '#34d399');

      status.textContent = data.database?.connected && data.redis?.connected ? 'healthy' : 'degraded';
      last.textContent = new Date().toLocaleTimeString();

    }catch(err){
      console.error('metrics error',err);
      logs.textContent = (logs.textContent||'') + '\n'+ new Date().toISOString() +' metrics fetch failed: '+err.message;
    }
  }

  function formatBytes(n){ if(!n && n!==0) return '-'; const kb=1024; if(n<kb) return n+'B'; if(n<kb*kb) return (n/kb).toFixed(1)+'KB'; if(n<kb*kb*kb) return (n/(kb*kb)).toFixed(1)+'MB'; return (n/(kb*kb*kb)).toFixed(2)+'GB'; }

  // Synthetic load test
  let stopFlag = false;
  async function runTest(){
    const endpoint = endpointInp.value || '/health';
    const total = parseInt(requestsInp.value||'20');
    const concurrency = Math.max(1,parseInt(concurrencyInp.value||'4'));
    stopFlag = false; runBtn.disabled=true; stopBtn.disabled=false; resPre.textContent='Running...';

    const results = [];
    let inFlight = 0; let sent=0; let completed=0;

    function schedule(){
      while(inFlight<concurrency && sent<total && !stopFlag){
        inFlight++; sent++;
        const start = performance.now();
        fetch(endpoint, {cache:'no-store'}).then(r=>r.text().then(()=>({ok:r.ok,status:r.status}))).then(r=>{
          const dur = performance.now()-start; results.push(dur);
        }).catch(e=>{ results.push({error:true,err:e.message}); }).finally(()=>{ inFlight--; completed++; if(completed===total||stopFlag) finish(); else schedule(); });
      }
    }

    function finish(){
      runBtn.disabled=false; stopBtn.disabled=true;
      const ok = results.filter(x=>typeof x==='number');
      const err = results.filter(x=>typeof x !== 'number');
      if(!ok.length){ resPre.textContent = 'No successful requests. Errors: '+JSON.stringify(err.slice(0,5)); return; }
      ok.sort((a,b)=>a-b);
      const sum = ok.reduce((s,v)=>s+v,0); const avg = (sum/ok.length).toFixed(2);
      const p95 = ok[Math.floor(ok.length*0.95)-1] ?? ok[ok.length-1]; const p50 = ok[Math.floor(ok.length*0.5)];
      resPre.textContent = `Requests: ${total}\nConcurrency: ${concurrency}\nSuccess: ${ok.length}\nErrors: ${err.length}\nAvg: ${avg} ms\nP50: ${Math.round(p50)} ms\nP95: ${Math.round(p95)} ms`;
    }

    schedule();
  }

  function stopTest(){ stopFlag=true; stopBtn.disabled=true; runBtn.disabled=false; }

  runBtn.addEventListener('click', runTest); stopBtn.addEventListener('click', stopTest);

  // initial load + polling
  fetchMetrics();
  setInterval(fetchMetrics, 5000);

  // expose simple logging from server via SSE? Not implemented — keep logs local
})();
