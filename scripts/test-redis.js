const dotenv = require('dotenv');
dotenv.config();
const Redis = require('ioredis');

(async function(){
  const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
  console.log('Using REDIS URL:', url);
  const opts = { lazyConnect: true, connectTimeout: 5000 };
  if (process.env.REDIS_TLS === 'true') opts.tls = {};
  const r = new Redis(url, opts);
  r.on('error', err => console.error('ioredis error event:', err && err.stack ? err.stack : err));
  r.on('close', () => console.log('ioredis close'));
  try {
    await r.connect();
    console.log('connected, ping ->', await r.ping());
    await r.quit();
    process.exit(0);
  } catch (e) {
    console.error('connect error:', e && e.stack ? e.stack : e);
    try { r.disconnect(); } catch(_){}
    process.exit(2);
  }
})();
