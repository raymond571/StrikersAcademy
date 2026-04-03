#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Production deployment script
# Run on the Hetzner VPS as a user with sudo access.
# Usage: bash deploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/strickersacademy"
BRANCH="master"
PM2_PROCESS="strikers-api"

echo "========================================="
echo " StrikersAcademy — Deploy"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# ── 1. Pull latest code ──────────────────────────────────────
echo ""
echo "→ Pulling latest code from origin/${BRANCH}..."
cd "$APP_DIR"
git fetch origin
git reset --hard "origin/${BRANCH}"

# ── 2. Install dependencies ──────────────────────────────────
echo ""
echo "→ Installing dependencies..."
npm ci --omit=dev

# ── 3. Generate Prisma client ────────────────────────────────
echo ""
echo "→ Generating Prisma client..."
npm run db:generate --workspace=server

# ── 4. Run database migrations ───────────────────────────────
echo ""
echo "→ Running database migrations..."
cd "$APP_DIR/server"
npx prisma migrate deploy
cd "$APP_DIR"

# ── 5. Build shared types ────────────────────────────────────
echo ""
echo "→ Building shared package..."
npm run build --workspace=shared

# ── 6. Build backend ─────────────────────────────────────────
echo ""
echo "→ Building backend..."
npm run build --workspace=server

# ── 7. Build frontend ────────────────────────────────────────
echo ""
echo "→ Building frontend..."
npm run build --workspace=client

# ── 8. Restart backend via PM2 ───────────────────────────────
echo ""
echo "→ Restarting PM2 process '${PM2_PROCESS}'..."
if pm2 describe "$PM2_PROCESS" > /dev/null 2>&1; then
    pm2 restart "$PM2_PROCESS"
else
    echo "  PM2 process not found — starting fresh with ecosystem config..."
    pm2 start "$APP_DIR/deployment/ecosystem.config.js"
fi
pm2 save

# ── 9. Reload Nginx ──────────────────────────────────────────
echo ""
echo "→ Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "========================================="
echo " Deploy complete!"
echo " API:  http://127.0.0.1:5000/health"
echo " Site: https://strickersacademy.in"
echo "========================================="
