module.exports = {
  apps: [
    {
      name: 'ghostline-engineer',
      script: 'engineer.js',
      args: '--pipeline',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      
      // Environment configuration
      env: {
        NODE_ENV: 'development',
        GHOSTLINE_MODE: 'pipeline',
        LOG_LEVEL: 'info'
      },
      
      env_production: {
        NODE_ENV: 'production',
        GHOSTLINE_MODE: 'pipeline',
        LOG_LEVEL: 'warn'
      },
      
      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Logging configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Monitoring
      monitoring: false,
      pmx: false,
      
      // Advanced PM2 features
      exec_mode: 'fork',
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // Custom configuration for Ghostline Engineer
      merge_logs: true,
      combine_logs: true
    }
  ],

  // Deployment configuration for PM2
  deploy: {
    production: {
      user: 'ghostline',
      host: 'production-server',
      ref: 'origin/main',
      repo: 'https://github.com/ghostline-project/agent-engineer.git',
      path: '/var/www/ghostline-engineer',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
