#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Production deployment script
# Run on the Hetzner VPS as a user with sudo access.
# Usage: bash deploy.sh [--skip-pull] [--branch <branch>]
# ─────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/var/www/strickersacademy"
BRANCH="master"
PM2_PROCESS="strikers-api"
SKIP_PULL=false

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull) SKIP_PULL=true; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "========================================="
echo " StrikersAcademy — Deploy"
echo " Branch: ${BRANCH}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# ── 1. Pull latest code ──────────────────────────────────────
if [ "$SKIP_PULL" = false ]; then
  echo ""
  echo "→ Pulling latest code from origin/${BRANCH}..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
else
  echo ""
  echo "→ Skipping git pull (--skip-pull)"
  cd "$APP_DIR"
fi

# ── 2. Swap Prisma provider to PostgreSQL for production ─────
echo ""
echo "→ Setting Prisma provider to postgresql..."
sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$APP_DIR/server/prisma/schema.prisma"

# ── 3. Install dependencies ──────────────────────────────────
echo ""
echo "→ Installing dependencies..."
npm ci --omit=dev

# ── 4. Generate Prisma client ────────────────────────────────
echo ""
echo "→ Generating Prisma client..."
npm run db:generate --workspace=server

# ── 5. Run database migrations ───────────────────────────────
echo ""
echo "→ Running database migrations..."
cd "$APP_DIR/server"
npx prisma migrate deploy
cd "$APP_DIR"

# ── 6. Build shared types ────────────────────────────────────
echo ""
echo "→ Building shared package..."
npm run build --workspace=shared

# ── 7. Build backend ─────────────────────────────────────────
echo ""
echo "→ Building backend..."
npm run build --workspace=server

# ── 8. Build frontend ────────────────────────────────────────
echo ""
echo "→ Building frontend..."
npm run build --workspace=client

# ── 9. Restart backend via PM2 ───────────────────────────────
echo ""
echo "→ Restarting PM2 process '${PM2_PROCESS}'..."
if pm2 describe "$PM2_PROCESS" > /dev/null 2>&1; then
    pm2 restart "$PM2_PROCESS"
else
    echo "  PM2 process not found — starting fresh with ecosystem config..."
    pm2 start "$APP_DIR/deployment/ecosystem.config.js"
fi
pm2 save

# ── 10. Reload Nginx ─────────────────────────────────────────
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
