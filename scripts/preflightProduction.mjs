import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const root = process.cwd();
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');

const results = [];

const requiredEnv = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REDIS_URL',
  'FRONTEND_URL',
  'SOCKET_REDIS_CONNECT_TIMEOUT_MS',
  'SOCKET_REDIS_MAX_RETRIES',
  'ROOM_STATE_TTL_SECONDS',
];

const placeholderPatterns = [
  /changeme/i,
  /your[-_ ]?server/i,
  /your[-_ ]?domain/i,
  /example/i,
  /localhost/i,
  /127\.0\.0\.1/i,
];

const secretLeakPatterns = [
  /sk-proj-[A-Za-z0-9_-]+/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /rzp_test_[A-Za-z0-9]+/g,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

const add = (level, message) => {
  results.push({ level, message });
};

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

if (!fs.existsSync(envPath)) {
  add('warn', '.env file not found. Deployment will fail unless environment variables are injected externally.');
}

for (const key of requiredEnv) {
  if (!hasValue(process.env[key])) {
    add('error', `Missing required env variable: ${key}`);
  }
}

if (process.env.NODE_ENV !== 'production') {
  add('warn', `NODE_ENV is '${process.env.NODE_ENV || 'undefined'}'. For production it should be 'production'.`);
}

const numericChecks = [
  { key: 'PORT', min: 1, max: 65535 },
  { key: 'SOCKET_REDIS_CONNECT_TIMEOUT_MS', min: 500, max: 30000 },
  { key: 'SOCKET_REDIS_MAX_RETRIES', min: 0, max: 100 },
  { key: 'ROOM_STATE_TTL_SECONDS', min: 60, max: 604800 },
];

for (const check of numericChecks) {
  const value = process.env[check.key];
  if (!value) continue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    add('error', `${check.key} must be numeric, got '${value}'.`);
    continue;
  }
  if (parsed < check.min || parsed > check.max) {
    add('warn', `${check.key}=${parsed} is outside recommended range [${check.min}, ${check.max}].`);
  }
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  add('warn', 'JWT_SECRET is shorter than 32 chars. Use a strong secret.');
}

if (process.env.REFRESH_TOKEN_SECRET && process.env.REFRESH_TOKEN_SECRET.length < 32) {
  add('warn', 'REFRESH_TOKEN_SECRET is shorter than 32 chars. Use a strong secret.');
}

if (fs.existsSync(envExamplePath)) {
  const exampleText = fs.readFileSync(envExamplePath, 'utf8');
  const uncommentedText = exampleText
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

  for (const pattern of secretLeakPatterns) {
    if (pattern.test(uncommentedText)) {
      add('error', `.env.example appears to contain real secrets matching pattern ${pattern.toString()}.`);
    }
  }

  if (/NODE_ENV=.*\n[\s\S]*NODE_ENV=/m.test(exampleText)) {
    add('warn', '.env.example contains duplicate NODE_ENV entries. Keep one canonical value.');
  }
}

for (const [key, value] of Object.entries(process.env)) {
  if (!value) continue;
  if (requiredEnv.includes(key) && placeholderPatterns.some((pattern) => pattern.test(value))) {
    add('warn', `${key} appears to contain a placeholder/local value ('${value}').`);
  }
}

add('info', 'Preflight completed.');

const errorCount = results.filter((r) => r.level === 'error').length;
const warnCount = results.filter((r) => r.level === 'warn').length;

for (const result of results) {
  const prefix = result.level === 'error' ? 'ERROR' : result.level === 'warn' ? 'WARN ' : 'INFO ';
  console.log(`[${prefix}] ${result.message}`);
}

console.log(`\nSummary: ${errorCount} error(s), ${warnCount} warning(s)`);

if (errorCount > 0) {
  process.exit(1);
}
