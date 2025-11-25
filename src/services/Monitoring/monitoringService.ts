import User from '../../models/User.js';
import { redisCache } from '../../config/redis.js';

type Counts = {
  activeUsers?: number; // placeholder
  recentSignups: number;
  recentLogins: number;
};

const SIGNUP_KEY = 'monitor:signup_count';
const LOGIN_KEY = 'monitor:login_count';
const KEY_TTL = 60 * 60; // 1 hour

class MonitoringService {
  // in-memory fallback counters
  private signupCounter = 0;
  private loginCounter = 0;

  async incrementSignup() {
    try {
      const client = redisCache.getClient();
      if (client) {
        await client.incr(SIGNUP_KEY);
        await client.expire(SIGNUP_KEY, KEY_TTL);
        return;
      }
    } catch (err) {
      console.error('❌ Redis incrementSignup error:', err);
    }

    // Fallback
    this.signupCounter++;
  }

  async incrementLogin() {
    try {
      const client = redisCache.getClient();
      if (client) {
        await client.incr(LOGIN_KEY);
        await client.expire(LOGIN_KEY, KEY_TTL);
        return;
      }
    } catch (err) {
      console.error('❌ Redis incrementLogin error:', err);
    }

    // Fallback
    this.loginCounter++;
  }

  resetCounters() {
    try {
      const client = redisCache.getClient();
      if (client) {
        client.del(SIGNUP_KEY, LOGIN_KEY).catch(() => {});
      }
    } catch (err) {
      // ignore
    }
    this.signupCounter = 0;
    this.loginCounter = 0;
  }

  async getCounts(): Promise<Counts> {
    // recent signups from DB (accurate for the last hour)
    const since = new Date(Date.now() - KEY_TTL * 1000);
    const recentSignups = await User.countDocuments({ createdAt: { $gte: since } }).exec();

    // recent logins: prefer Redis value, fallback to in-memory
    let recentLogins = this.loginCounter;
    try {
      const cached = await redisCache.get(LOGIN_KEY);
      if (cached !== null) {
        const n = parseInt(cached as string, 10);
        if (!Number.isNaN(n)) recentLogins = n;
      }
    } catch (err) {
      // ignore and fall back
    }

    return {
      recentSignups,
      recentLogins,
    };
  }
}

const monitoringService = new MonitoringService();
export default monitoringService;
