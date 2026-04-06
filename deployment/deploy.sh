#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Production deployment script
# Run on the Hetzner VPS as a user with sudo access.
# Usage: bash deploy.sh [--skip-pull] [--branch <branch>]
#
# FLAGS:
#   --skip-pull   Skip git fetch/reset. Use when called from
#                 GitHub Actions (Actions does its own git reset
#                 and writes .env before calling this script).
#   --branch <b>  Deploy a specific branch (default: master).
#
# LESSONS LEARNED (real deployment):
#   1. Do NOT use `--omit=dev` in npm ci — TypeScript is a
#      devDependency needed for the build step.
#   2. Must `rm -rf node_modules` before npm ci. Stale dirs
#      cause TAR_ENTRY_ERROR / ENOTEMPTY on npm ci.
#   3. Must sed-swap Prisma provider sqlite->postgresql before
#      generate, because git reset reverts schema to sqlite.
#   4. Must use `prisma db push` not `prisma migrate deploy`.
#      migration_lock.toml says sqlite, causing mismatch errors.
#   5. GitHub Actions workflow should pass --skip-pull because
#      it does git reset first, then writes .env files.
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
echo " Skip pull: ${SKIP_PULL}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# ── 1. Pull latest code ──────────────────────────────────────
if [ "$SKIP_PULL" = false ]; then
  echo ""
  echo "-> Pulling latest code from origin/${BRANCH}..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
else
  echo ""
  echo "-> Skipping git pull (--skip-pull)"
  cd "$APP_DIR"
fi

# ── 2. Swap Prisma provider to PostgreSQL for production ─────
# GOTCHA: git reset --hard reverts schema.prisma to sqlite.
# This MUST happen before prisma generate or db push.
echo ""
echo "-> Setting Prisma provider to postgresql..."
sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$APP_DIR/server/prisma/schema.prisma"

# ── 3. Clean + install dependencies ─────────────────────────
# GOTCHA: Stale node_modules cause `npm ci` TAR_ENTRY_ERROR.
# GOTCHA: Do NOT use --omit=dev — TypeScript needed for build.
echo ""
echo "-> Cleaning node_modules (prevents TAR_ENTRY_ERROR)..."
rm -rf "$APP_DIR/node_modules" "$APP_DIR/server/node_modules" "$APP_DIR/client/node_modules" "$APP_DIR/shared/node_modules"

echo "-> Installing dependencies (full install, devDeps included for build)..."
npm ci

# ── 4. Generate Prisma client ────────────────────────────────
# GOTCHA: Must regenerate after every git reset because schema
# reverts to sqlite provider. The sed swap above fixes the
# schema file, but the generated client is stale/wrong.
echo ""
echo "-> Generating Prisma client..."
npm run db:generate --workspace=server

# ── 5. Sync database schema ─────────────────────────────────
# GOTCHA: `prisma migrate deploy` fails because migration_lock.toml
# says sqlite. We use `prisma db push` which compares the schema
# directly against the database without migration history.
echo ""
echo "-> Pushing database schema (prisma db push)..."
cd "$APP_DIR/server"
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push
cd "$APP_DIR"

# ── 6. Build shared types ────────────────────────────────────
echo ""
echo "-> Building shared package..."
npm run build --workspace=shared

# ── 7. Build backend ─────────────────────────────────────────
# NOTE: PM2 script path is dist/server/src/index.js (not dist/index.js)
# because tsc outputs nested structure due to shared workspace includes.
echo ""
echo "-> Building backend..."
npm run build --workspace=server

# ── 8. Build frontend ────────────────────────────────────────
# NOTE: Nginx serves static files from /var/www/strickersacademy/client/dist
echo ""
echo "-> Building frontend..."
npm run build --workspace=client

# ── 9. Restart backend via PM2 ───────────────────────────────
echo ""
echo "-> Restarting PM2 process '${PM2_PROCESS}'..."
if pm2 describe "$PM2_PROCESS" > /dev/null 2>&1; then
    pm2 restart "$PM2_PROCESS"
else
    echo "  PM2 process not found — starting fresh with ecosystem config..."
    pm2 start "$APP_DIR/deployment/ecosystem.config.js"
fi
pm2 save

# ── 10. Reload Nginx ─────────────────────────────────────────
echo ""
echo "-> Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "========================================="
echo " Deploy complete!"
echo " API:  http://127.0.0.1:5000/health"
echo " Site: https://strickersacademy.in"
echo "========================================="
