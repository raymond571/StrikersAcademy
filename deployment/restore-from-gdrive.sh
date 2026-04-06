#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Disaster Recovery: Restore from Google Drive
#
# Use this when the VPS crashed and you need to restore on a
# fresh server. Downloads the latest backup from Google Drive
# and restores the database.
#
# Prerequisites:
#   - PostgreSQL installed and running
#   - Database user 'strikers_user' exists
#   - rclone installed and configured with 'gdrive' remote
#
# Usage:
#   bash deployment/restore-from-gdrive.sh           # latest backup
#   bash deployment/restore-from-gdrive.sh --list    # list available
#   bash deployment/restore-from-gdrive.sh <filename> # specific file
# ─────────────────────────────────────────────────────────────

set -euo pipefail

DB_NAME="strikersacademy"
DB_USER="strikers_user"
DB_HOST="127.0.0.1"
DB_PORT="5432"
GDRIVE_REMOTE="gdrive"
GDRIVE_FOLDER="StrikersAcademy-Backups"
LOCAL_DIR="/var/backups/strikersacademy"

# ── Check rclone ─────────────────────────────────────────────
if ! command -v rclone &>/dev/null; then
  echo "ERROR: rclone is not installed. Install it first:"
  echo "  curl https://rclone.org/install.sh | sudo bash"
  exit 1
fi

if ! rclone listremotes 2>/dev/null | grep -q "^${GDRIVE_REMOTE}:"; then
  echo "ERROR: rclone remote '${GDRIVE_REMOTE}' not configured."
  echo "  Run: rclone config"
  exit 1
fi

# ── List mode ────────────────────────────────────────────────
if [ "${1:-}" = "--list" ]; then
  echo "Available backups on Google Drive:"
  echo "──────────────────────────────────"
  rclone ls "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/" 2>/dev/null | sort -k2 | awk '{printf "%s  %s\n", $2, $1}'
  exit 0
fi

# ── Select backup ────────────────────────────────────────────
if [ $# -ge 1 ] && [ "$1" != "--list" ]; then
  BACKUP_NAME="$1"
else
  # Get the latest backup
  BACKUP_NAME=$(rclone ls "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/" 2>/dev/null | sort -k2 | tail -1 | awk '{print $2}')
  if [ -z "$BACKUP_NAME" ]; then
    echo "ERROR: No backups found on Google Drive at ${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/"
    exit 1
  fi
  echo "Latest backup: $BACKUP_NAME"
fi

LOCAL_FILE="${LOCAL_DIR}/${BACKUP_NAME}"

# ── Download ─────────────────────────────────────────────────
mkdir -p "$LOCAL_DIR"

echo "Downloading ${BACKUP_NAME} from Google Drive..."
if rclone copy "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/${BACKUP_NAME}" "$LOCAL_DIR/"; then
  echo "Downloaded to: $LOCAL_FILE"
else
  echo "ERROR: Download failed"
  exit 1
fi

if [ ! -f "$LOCAL_FILE" ]; then
  echo "ERROR: File not found after download: $LOCAL_FILE"
  exit 1
fi

SIZE=$(du -h "$LOCAL_FILE" | cut -f1)
echo "File size: $SIZE"

# ── Confirm ──────────────────────────────────────────────────
echo ""
echo "WARNING: This will DROP and RECREATE the '${DB_NAME}' database!"
echo "  Backup: $BACKUP_NAME"
echo "  Target: $DB_NAME"
echo ""
echo "Type 'yes' to continue:"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted. The file is still at: $LOCAL_FILE"
  exit 0
fi

# ── Stop the app ─────────────────────────────────────────────
echo "Stopping StrikersAcademy..."
pm2 stop strikers-api 2>/dev/null || true

# ── Restore ──────────────────────────────────────────────────
echo "Dropping and recreating database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "Restoring from backup..."
gunzip -c "$LOCAL_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q

# ── Restart the app ──────────────────────────────────────────
echo "Starting StrikersAcademy..."
pm2 start strikers-api 2>/dev/null || echo "PM2 not running — start manually after full VPS setup"

echo ""
echo "========================================="
echo " Restore complete!"
echo " Database restored from: $BACKUP_NAME"
echo "========================================="
echo ""
echo "If this is a fresh VPS, run the full setup next:"
echo "  bash deployment/setup-vps.sh"
