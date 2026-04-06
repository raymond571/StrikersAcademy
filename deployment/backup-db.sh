#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Daily PostgreSQL Database Backup
# Runs via cron at 00:00 daily. Keeps last 30 days of backups.
#
# Setup:  sudo bash deployment/setup-backup-cron.sh
# Manual: sudo bash deployment/backup-db.sh
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ───────────────────────────────────────────────────
BACKUP_DIR="/var/backups/strikersacademy"
DB_NAME="strikersacademy"
DB_USER="strikers_user"
DB_HOST="127.0.0.1"
DB_PORT="5432"
RETENTION_DAYS=30
LOG_FILE="/var/log/strikersacademy-backup.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# ── Functions ────────────────────────────────────────────────
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cleanup_old_backups() {
  local count
  count=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} | wc -l)
  if [ "$count" -gt 0 ]; then
    find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
    log "Cleaned up $count backup(s) older than ${RETENTION_DAYS} days"
  fi
}

# ── Main ─────────────────────────────────────────────────────
log "Starting database backup..."

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Run pg_dump and compress
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "Backup successful: $BACKUP_FILE ($SIZE)"
else
  log "ERROR: Backup failed!"
  rm -f "$BACKUP_FILE"  # Remove partial file
  exit 1
fi

# Clean up old backups
cleanup_old_backups

# Show backup count
TOTAL=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
log "Total backups on disk: $TOTAL"
log "Done."
