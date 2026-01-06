#!/bin/bash
# MCP Monitor Deploy Script (PM2)

set -e

# SSH config 호스트명 사용 (기본: seoul)
SSH_HOST="${1:-seoul}"
DEPLOY_PATH="~/mcp-monitor"

echo "=== Deploying MCP Monitor ==="
echo "SSH Host: ${SSH_HOST}"
echo "Path: ${DEPLOY_PATH}"

# 1. Build locally
echo ""
echo ">>> Building locally..."
npm run build

# 2. Sync files to server
echo ""
echo ">>> Syncing files..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='.idea' --exclude='logs' \
    ./ ${SSH_HOST}:${DEPLOY_PATH}/

# 3. Setup on server
echo ""
echo ">>> Setting up server..."
ssh ${SSH_HOST} << 'EOF'
# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd ~/mcp-monitor

# Create logs directory
mkdir -p logs

# Install Node.js dependencies
npm install

# Install PM2 globally if not exists
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Stop existing processes (ignore errors)
pm2 delete mcp-monitor-api mcp-monitor-frontend 2>/dev/null || true

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list for auto-restart on reboot
pm2 save

# Setup PM2 startup (if not already done)
pm2 startup 2>/dev/null || true

echo ""
echo ">>> PM2 Status:"
pm2 list
EOF

echo ""
echo "=== Deployment complete! ==="
echo ""
echo "SSH Host: ${SSH_HOST}"
echo "Frontend: http://${SSH_HOST}:4173"
echo "API Server: http://${SSH_HOST}:3001"
echo ""
echo "Useful commands:"
echo "  pm2 list"
echo "  pm2 logs mcp-monitor-api"
echo "  pm2 logs mcp-monitor-frontend"
echo "  pm2 restart all"
echo "  pm2 monit"
