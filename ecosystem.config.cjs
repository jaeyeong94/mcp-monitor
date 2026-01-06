module.exports = {
  apps: [
    {
      name: 'mcp-monitor-api',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: '/home/ubuntu/mcp-monitor',
      env: {
        NODE_ENV: 'production',
        MCP_API_BASE: 'http://localhost:8080',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/home/ubuntu/mcp-monitor/logs/api-error.log',
      out_file: '/home/ubuntu/mcp-monitor/logs/api-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'mcp-monitor-frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 4173',
      cwd: '/home/ubuntu/mcp-monitor',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      error_file: '/home/ubuntu/mcp-monitor/logs/frontend-error.log',
      out_file: '/home/ubuntu/mcp-monitor/logs/frontend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
