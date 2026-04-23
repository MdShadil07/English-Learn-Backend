module.exports = {
  apps: [
    {
      name: 'english-practice-backend',
      script: 'dist/index.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable clustering for scalability
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Auto-restart configuration for high availability
      autorestart: true,
      watch: false, // Don't watch files in production
      max_memory_restart: '1G', // Restart if memory exceeds 1GB
      restart_delay: 4000, // Delay between restarts
      max_restarts: 10, // Max restarts in a time window

      // Logging configuration
      log_file: './logs/app.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',

      // Health check and monitoring
      health_check: {
        enabled: true,
        path: '/health',
        port: 5000,
        timeout: 5000,
        delay: 30000, // Check every 30 seconds
        max_retries: 3
      },

      // Graceful shutdown
      kill_timeout: 5000, // Wait 5 seconds before force kill
      wait_ready: true, // Wait for app to be ready before considering started

      // Environment variables for scalability
      env: {
        ...process.env,
        PM2_CLUSTER_INSTANCES: 'max',
        PM2_GRACEFUL_TIMEOUT: 5000
      }
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'node',
      host: 'your-server-ip',
      ref: 'origin/master',
      repo: 'git@github.com:yourusername/english-practice-backend.git',
      path: '/var/www/english-practice-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
