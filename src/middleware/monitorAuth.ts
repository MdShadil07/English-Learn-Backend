import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const MONITOR_API_KEY = process.env.MONITOR_API_KEY;

export default function monitorAuth(req: Request, res: Response, next: NextFunction) {
  // Support header `x-monitor-api-key` or query `api_key` primarily.
  // Also support `Authorization: ApiKey <key>` or a Bearer value that exactly equals the configured API key.
  const headerKey = (req.headers['x-monitor-api-key'] as string) || '';
  const queryKey = (req.query.api_key as string) || '';
  const authHeader = (req.headers.authorization as string) || '';
  let provided = '';

  if (headerKey) provided = headerKey;
  else if (queryKey) provided = queryKey;
  else if (!provided && req.headers.cookie) {
    // parse basic cookie string for `monitor_api_key`
    const c = (req.headers.cookie as string) || '';
    const match = c.split(';').map(s => s.trim()).find(s => s.startsWith('monitor_api_key='));
    if (match) {
      provided = decodeURIComponent(match.split('=')[1] || '')
    }
  }
  else if (authHeader.startsWith('ApiKey ')) {
    provided = authHeader.slice(7).trim();
  } else if (authHeader.startsWith('Bearer ')) {
    // Avoid accidentally treating normal JWT bearer tokens as the monitor API key.
    const maybe = authHeader.slice(7).trim();
    const isProbablyJwt = (maybe.match(/\./g) || []).length >= 2;
    if (!isProbablyJwt) {
      // only accept a bare token if it exactly matches the configured API key
      provided = maybe;
    }
  }

  if (!MONITOR_API_KEY) {
    // If no key configured, deny in production; allow in development but warn
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ MONITOR_API_KEY not set — monitoring endpoints are unsecured in development');
      return next();
    }
    return res.status(500).json({ success: false, message: 'Monitoring not configured' });
  }

  if (!provided || provided !== MONITOR_API_KEY) {
    // If the client accepts HTML (likely a browser), redirect to the monitor entry page
    // so users who visit endpoints directly get a friendly prompt instead of a JSON 401.
    const accept = (req.headers.accept || '') as string;
    if (accept.includes('text/html')) {
      return res.redirect(302, '/monitor');
    }
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  return next();
}
