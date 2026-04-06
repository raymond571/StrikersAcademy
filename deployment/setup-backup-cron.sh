#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Setup daily backup cron job
# Run once on the server: sudo bash deployment/setup-backup-cron.sh
# ─────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="/var/www/strickersacademy"
BACKUP_SCRIPT="${APP_DIR}/deployment/backup-db.sh"
BACKUP_DIR="/var/backups/strikersacademy"
LOG_FILE="/var/log/strikersacademy-backup.log"
CRON_ENTRY="0 0 * * * ${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1"

echo "Setting up StrikersAcademy daily database backup..."

# 1. Create backup directory
mkdir -p "$BACKUP_DIR"
echo "  Created $BACKUP_DIR"

# 2. Create log file
touch "$LOG_FILE"
echo "  Created $LOG_FILE"

# 3. Make backup script executable
chmod +x "$BACKUP_SCRIPT"
echo "  Made backup script executable"

# 4. Set up PostgreSQL password file for non-interactive pg_dump
PGPASS_FILE="/root/.pgpass"
if [ ! -f "$PGPASS_FILE" ]; then
  echo "  Creating .pgpass for passwordless pg_dump..."
  echo "  Enter the PostgreSQL password for strikers_user:"
  read -s -r DB_PASS
  echo "127.0.0.1:5432:strikersacademy:strikers_user:${DB_PASS}" > "$PGPASS_FILE"
  chmod 600 "$PGPASS_FILE"
  echo "  Created $PGPASS_FILE (chmod 600)"
else
  echo "  .pgpass already exists, skipping"
fi

# 5. Install cron job (idempotent — won't duplicate)
EXISTING=$(crontab -l 2>/dev/null || true)
if echo "$EXISTING" | grep -qF "backup-db.sh"; then
  echo "  Cron job already exists, skipping"
else
  (echo "$EXISTING"; echo ""; echo "# StrikersAcademy daily DB backup at midnight IST"; echo "CRON_TZ=Asia/Kolkata"; echo "$CRON_ENTRY") | crontab -
  echo "  Installed cron job: daily at 00:00 IST (Asia/Kolkata)"
fi

# 6. Run a test backup
echo ""
echo "Running test backup..."
bash "$BACKUP_SCRIPT"

echo ""
echo "Setup complete!"
echo "  Schedule:  Every day at 00:00 IST (Asia/Kolkata)"
echo "  Backups:   $BACKUP_DIR"
echo "  Retention: 30 days"
echo "  Logs:      $LOG_FILE"
echo ""
echo "Verify with: crontab -l"
echo "Manual run:  sudo bash $BACKUP_SCRIPT"
