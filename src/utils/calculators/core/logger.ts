import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  name: 'accuracy-engine',
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Specialized loggers
export const nlpLogger = logger.child({ component: 'nlp' });
export const xpLogger = logger.child({ component: 'xp' });
export const cacheLogger = logger.child({ component: 'cache' });
export const performanceLogger = logger.child({ component: 'performance' });

// Export default for module resolution
export default logger;
