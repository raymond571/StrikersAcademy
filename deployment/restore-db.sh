#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Restore PostgreSQL Database from Backup
# Usage: sudo bash deployment/restore-db.sh [backup_file]
#
# If no file specified, lists available backups to choose from.
# WARNING: This replaces the current database entirely!
# ─────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_DIR="/var/backups/strikersacademy"
DB_NAME="strikersacademy"
DB_USER="strikers_user"
DB_HOST="127.0.0.1"
DB_PORT="5432"

# ── Select backup file ───────────────────────────────────────
if [ $# -ge 1 ]; then
  BACKUP_FILE="$1"
else
  echo "Available backups:"
  echo "──────────────────"
  ls -lh "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null | awk '{print NR")", $NF, "("$5")", $6, $7, $8}'
  echo ""
  echo "Enter backup number (or full path):"
  read -r CHOICE

  if [[ "$CHOICE" =~ ^[0-9]+$ ]]; then
    BACKUP_FILE=$(ls "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null | sed -n "${CHOICE}p")
  else
    BACKUP_FILE="$CHOICE"
  fi
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo ""
echo "WARNING: This will DROP and RECREATE the database!"
echo "  Backup: $BACKUP_FILE"
echo "  Target: $DB_NAME"
echo ""
echo "Type 'yes' to continue:"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
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
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q

# ── Restart the app ──────────────────────────────────────────
echo "Starting StrikersAcademy..."
pm2 start strikers-api

echo ""
echo "Restore complete! Database restored from: $(basename "$BACKUP_FILE")"

