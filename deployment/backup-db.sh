#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Daily PostgreSQL Database Backup
# Runs via cron at 00:00 IST daily. Keeps last 30 days locally.
# Uploads to Google Drive via rclone (if configured).
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

# Google Drive config (via rclone)
GDRIVE_REMOTE="gdrive"
GDRIVE_FOLDER="StrikersAcademy-Backups"

# ── Functions ────────────────────────────────────────────────
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cleanup_old_backups() {
  local count
  count=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} | wc -l)
  if [ "$count" -gt 0 ]; then
    find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
    log "Cleaned up $count local backup(s) older than ${RETENTION_DAYS} days"
  fi
}

upload_to_gdrive() {
  if ! command -v rclone &>/dev/null; then
    log "SKIP: rclone not installed — Google Drive upload skipped"
    return 0
  fi

  if ! rclone listremotes 2>/dev/null | grep -q "^${GDRIVE_REMOTE}:"; then
    log "SKIP: rclone remote '${GDRIVE_REMOTE}' not configured — Google Drive upload skipped"
    return 0
  fi

  log "Uploading to Google Drive: ${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/..."
  if rclone copy "$BACKUP_FILE" "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/" --log-level ERROR 2>&1 | tee -a "$LOG_FILE"; then
    log "Google Drive upload successful"
  else
    log "WARNING: Google Drive upload failed (local backup is safe)"
  fi

  # Clean old backups on Google Drive (keep same retention)
  local gdrive_count
  gdrive_count=$(rclone ls "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/" 2>/dev/null | wc -l)
  if [ "$gdrive_count" -gt "$RETENTION_DAYS" ]; then
    log "Cleaning old Google Drive backups (keeping ${RETENTION_DAYS})..."
    rclone delete "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/" --min-age "${RETENTION_DAYS}d" --log-level ERROR 2>&1 | tee -a "$LOG_FILE"
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
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Upload to Google Drive
upload_to_gdrive

# Clean up old local backups
cleanup_old_backups

# Summary
TOTAL=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
log "Total local backups: $TOTAL"
log "Done."

