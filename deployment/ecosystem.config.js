// PM2 Ecosystem Configuration — StrikersAcademy
// Start:   pm2 start deployment/ecosystem.config.js
// Restart: pm2 restart strikers-api
// Logs:    pm2 logs strikers-api

module.exports = {
  apps: [
    {
      name: 'strikers-api',
      cwd: '/var/www/strickersacademy/server',
      script: 'dist/server/src/index.js',
      interpreter: 'node',

      // Instances & mode
      instances: 1, // single instance is fine for ~200 daily users
      exec_mode: 'fork',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '127.0.0.1', // only listen on localhost; Nginx handles external traffic
      },

      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      autorestart: true,

      // Logging
      error_file: '/var/log/pm2/strikers-api-error.log',
      out_file: '/var/log/pm2/strikers-api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,

      // Memory guard — restart if > 300 MB
      max_memory_restart: '300M',
    },
  ],
};
