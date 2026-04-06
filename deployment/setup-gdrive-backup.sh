#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Setup Google Drive Backup via rclone
#
# Run once on the VPS:
#   sudo bash deployment/setup-gdrive-backup.sh
#
# This installs rclone and guides you through Google Drive auth.
# After setup, daily backups auto-upload to Google Drive.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

GDRIVE_REMOTE="gdrive"
GDRIVE_FOLDER="StrikersAcademy-Backups"
GDRIVE_EMAIL="${1:-}"

echo "========================================="
echo " StrikersAcademy — Google Drive Backup Setup"
echo "========================================="
echo ""

# ── 1. Install rclone ───────────────────────────────────────
if command -v rclone &>/dev/null; then
  echo "rclone already installed: $(rclone version | head -1)"
else
  echo "Installing rclone..."
  curl -s https://rclone.org/install.sh | bash
  echo "rclone installed: $(rclone version | head -1)"
fi

# ── 2. Configure rclone with Google Drive ────────────────────
echo ""
if rclone listremotes 2>/dev/null | grep -q "^${GDRIVE_REMOTE}:"; then
  echo "rclone remote '${GDRIVE_REMOTE}' already configured."
  echo "To reconfigure, run: rclone config delete ${GDRIVE_REMOTE} && rclone config"
else
  echo "Now we need to connect rclone to Google Drive."
  echo ""
  echo "Since this is a headless server, you'll need to authorize"
  echo "from your local machine. Follow these steps:"
  echo ""
  echo "─────────────────────────────────────────"
  echo "OPTION A: Use rclone authorize (recommended)"
  echo "─────────────────────────────────────────"
  echo ""
  echo "1. On your LOCAL machine (Windows/Mac), install rclone:"
  echo "   https://rclone.org/downloads/"
  echo ""
  echo "2. On your LOCAL machine, run:"
  echo "   rclone authorize \"drive\""
  echo ""
  echo "3. A browser window opens — sign in with your Google account"
  echo "   and allow access."
  echo ""
  echo "4. rclone prints a token in the terminal. Copy the ENTIRE"
  echo "   JSON block (starts with {\"access_token\":...})"
  echo ""
  echo "5. Come back here and paste it when prompted."
  echo ""
  echo "─────────────────────────────────────────"
  echo ""
  echo "Press Enter when you have the token ready..."
  read -r

  echo "Now running rclone config. Follow the prompts:"
  echo "  - name: ${GDRIVE_REMOTE}"
  echo "  - storage: drive (type 'drive' or the number for Google Drive)"
  echo "  - client_id: leave blank (press Enter)"
  echo "  - client_secret: leave blank (press Enter)"
  echo "  - scope: 1 (Full access)"
  echo "  - root_folder_id: leave blank"
  echo "  - service_account_file: leave blank"
  echo "  - auto config: n (no, since this is headless)"
  echo "  - Paste the token from your local machine"
  echo "  - team drive: n"
  echo "  - Confirm: y"
  echo ""
  rclone config
fi

# ── 3. Test the connection ───────────────────────────────────
echo ""
echo "Testing Google Drive connection..."
if rclone mkdir "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}" 2>/dev/null; then
  echo "Created folder '${GDRIVE_FOLDER}' on Google Drive"

  # Test write
  echo "StrikersAcademy backup test - $(date)" > /tmp/gdrive-test.txt
  if rclone copy /tmp/gdrive-test.txt "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/" 2>/dev/null; then
    echo "Test file uploaded successfully"
    rclone delete "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/gdrive-test.txt" 2>/dev/null
    echo "Test file cleaned up"
  else
    echo "WARNING: Upload test failed. Check rclone config."
  fi
  rm -f /tmp/gdrive-test.txt
else
  echo "WARNING: Could not create folder. Check rclone config."
fi

# ── 4. Run a test backup ────────────────────────────────────
echo ""
echo "Running a test backup with Google Drive upload..."
APP_DIR="/var/www/strickersacademy"
if [ -f "${APP_DIR}/deployment/backup-db.sh" ]; then
  bash "${APP_DIR}/deployment/backup-db.sh"
else
  echo "SKIP: backup-db.sh not found at ${APP_DIR}/deployment/"
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "========================================="
echo " Google Drive Backup Setup Complete!"
echo "========================================="
echo ""
echo "  Remote:     ${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/"
echo "  Schedule:   Daily at 00:00 IST (via existing cron)"
echo "  Retention:  ${GDRIVE_FOLDER} — 30 days"
echo ""
echo "  List backups:   rclone ls ${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/"
echo "  Manual backup:  bash deployment/backup-db.sh"
echo "  Restore:        bash deployment/restore-from-gdrive.sh"
echo "  Disaster recovery (new VPS):"
echo "    1. Install rclone: curl https://rclone.org/install.sh | sudo bash"
echo "    2. Configure: rclone config (add '${GDRIVE_REMOTE}' remote)"
echo "    3. Restore: bash deployment/restore-from-gdrive.sh"
echo ""
