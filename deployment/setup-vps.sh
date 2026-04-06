#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# StrikersAcademy — Automated VPS Setup Script
# Run as root (or with sudo) on a fresh Ubuntu 22.04/24.04 VPS.
# Usage: bash setup-vps.sh
#
# LESSONS LEARNED (real deployment):
#   - npm ci fails with TAR_ENTRY_ERROR if stale node_modules exist
#   - Prisma migration_lock.toml mismatches sqlite->postgresql;
#     must delete migrations and use `prisma db push` instead
#   - Deploy user needs .pgpass for passwordless pg_dump
#   - Git "dubious ownership" requires safe.directory config
#   - PM2 script path is dist/server/src/index.js (tsc nested output)
#   - Prisma client needs regeneration after every git reset --hard
#   - Seed script needs env vars exported manually outside PM2
#   - Server tsconfig must exclude *.test.ts from build
#   - Client tsconfig must exclude test files, needs vite-env.d.ts
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Color helpers ────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

header()  { echo -e "\n${BLUE}${BOLD}════════════════════════════════════════${NC}"; echo -e "${BLUE}${BOLD}  $1${NC}"; echo -e "${BLUE}${BOLD}════════════════════════════════════════${NC}"; }
info()    { echo -e "${CYAN}→ $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
error()   { echo -e "${RED}✗ $1${NC}"; }
ask()     { echo -en "${YELLOW}? $1${NC}"; }

# ── Pre-flight checks ───────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (or with sudo)."
    exit 1
fi

header "StrikersAcademy — VPS Setup"
echo -e "${BOLD}Domain:${NC}  strickersacademy.in"
echo -e "${BOLD}Repo:${NC}    https://github.com/raymond571/StrikersAcademy.git"
echo -e "${BOLD}Date:${NC}    $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── Collect DB password ─────────────────────────────────────
DB_USER="strikers_user"
DB_NAME="strikersacademy"
APP_DIR="/var/www/strickersacademy"
DEPLOY_USER="deploy"
REPO_URL="https://github.com/raymond571/StrikersAcademy.git"
BRANCH="master"

ask "Enter a password for PostgreSQL user '${DB_USER}' (or press Enter to auto-generate): "
read -r DB_PASSWORD

if [[ -z "$DB_PASSWORD" ]]; then
    DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
    info "Auto-generated DB password: ${BOLD}${DB_PASSWORD}${NC}"
fi

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"

echo ""
warn "Make sure you have access to the GitHub repo. You may be prompted for credentials during clone."
ask "Press Enter to continue..."
read -r

# ─────────────────────────────────────────────────────────────
# STEP 1: System Updates
# ─────────────────────────────────────────────────────────────
header "1/20  System Updates"

info "Setting timezone to Asia/Kolkata (IST)..."
timedatectl set-timezone Asia/Kolkata
success "Timezone set to $(timedatectl show -p Timezone --value) (IST, UTC+5:30)."

info "Running apt update && upgrade..."
export DEBIAN_FRONTEND=noninteractive
apt update -y
apt upgrade -y
success "System updated."

# ─────────────────────────────────────────────────────────────
# STEP 2: Create Deploy User
# ─────────────────────────────────────────────────────────────
header "2/20  Create Deploy User"

if id "${DEPLOY_USER}" &>/dev/null; then
    warn "User '${DEPLOY_USER}' already exists, skipping creation."
else
    info "Creating user '${DEPLOY_USER}'..."
    adduser --disabled-password --gecos "Deploy User" "${DEPLOY_USER}"
    usermod -aG sudo "${DEPLOY_USER}"
    success "User '${DEPLOY_USER}' created and added to sudo group."
fi

# Enable passwordless sudo for deploy user
if [[ ! -f /etc/sudoers.d/${DEPLOY_USER} ]]; then
    echo "${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${DEPLOY_USER}
    chmod 440 /etc/sudoers.d/${DEPLOY_USER}
    success "Passwordless sudo configured for '${DEPLOY_USER}'."
else
    warn "Sudoers entry already exists for '${DEPLOY_USER}'."
fi

# ─────────────────────────────────────────────────────────────
# STEP 3: Firewall (UFW)
# ─────────────────────────────────────────────────────────────
header "3/20  Firewall (UFW)"

if command -v ufw &>/dev/null; then
    info "Configuring UFW..."
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment "SSH"
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    echo "y" | ufw enable
    success "UFW enabled. Allowed ports: 22, 80, 443."
else
    info "Installing UFW..."
    apt install -y ufw
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment "SSH"
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    echo "y" | ufw enable
    success "UFW installed and enabled. Allowed ports: 22, 80, 443."
fi

# ─────────────────────────────────────────────────────────────
# STEP 4: Install Essentials
# ─────────────────────────────────────────────────────────────
header "4/20  Install Essentials"

info "Installing curl, git, build-essential, unzip..."
apt install -y curl git build-essential unzip
success "Essentials installed."

# ─────────────────────────────────────────────────────────────
# STEP 5: Install Node.js v20 LTS
# ─────────────────────────────────────────────────────────────
header "5/20  Install Node.js v20 LTS"

if command -v node &>/dev/null && node -v | grep -q "^v20"; then
    warn "Node.js $(node -v) is already installed, skipping."
else
    info "Installing Node.js v20 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    success "Node.js $(node -v) installed."
fi

info "Node: $(node -v), npm: $(npm -v)"

# ─────────────────────────────────────────────────────────────
# STEP 6: Install PM2
# ─────────────────────────────────────────────────────────────
header "6/20  Install PM2"

if command -v pm2 &>/dev/null; then
    warn "PM2 is already installed, skipping."
else
    info "Installing PM2 globally..."
    npm install -g pm2
    success "PM2 installed."
fi

# Create PM2 log directory
mkdir -p /var/log/pm2
chown ${DEPLOY_USER}:${DEPLOY_USER} /var/log/pm2
success "PM2 log directory created at /var/log/pm2."

# ─────────────────────────────────────────────────────────────
# STEP 7: Install PostgreSQL
# ─────────────────────────────────────────────────────────────
header "7/20  Install PostgreSQL"

if command -v psql &>/dev/null; then
    warn "PostgreSQL is already installed, skipping installation."
else
    info "Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    success "PostgreSQL installed."
fi

systemctl enable postgresql
systemctl start postgresql

info "Creating database '${DB_NAME}' and user '${DB_USER}'..."

# Check if user already exists
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
    warn "PostgreSQL user '${DB_USER}' already exists. Updating password."
    sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
else
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
    success "PostgreSQL user '${DB_USER}' created."
fi

# Check if database already exists
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    warn "Database '${DB_NAME}' already exists, skipping."
else
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
    success "Database '${DB_NAME}' created."
fi

# ─────────────────────────────────────────────────────────────
# STEP 8: Install Nginx
# ─────────────────────────────────────────────────────────────
header "8/20  Install Nginx"

if command -v nginx &>/dev/null; then
    warn "Nginx is already installed, skipping."
else
    info "Installing Nginx..."
    apt install -y nginx
    success "Nginx installed."
fi

systemctl enable nginx
systemctl start nginx

# Remove default site
rm -f /etc/nginx/sites-enabled/default
success "Nginx enabled, default site removed."

# ─────────────────────────────────────────────────────────────
# STEP 9: Create App Directory
# ─────────────────────────────────────────────────────────────
header "9/20  Create App Directory"

if [[ -d "$APP_DIR" ]]; then
    warn "App directory ${APP_DIR} already exists."
else
    mkdir -p "$APP_DIR"
    success "Created ${APP_DIR}."
fi

chown -R ${DEPLOY_USER}:${DEPLOY_USER} "$APP_DIR"
success "Ownership set to ${DEPLOY_USER}."

# ─────────────────────────────────────────────────────────────
# STEP 10: Clone the Repo
# ─────────────────────────────────────────────────────────────
header "10/20  Clone Repository"

if [[ -d "${APP_DIR}/.git" ]]; then
    warn "Repository already cloned. Pulling latest..."
    sudo -u ${DEPLOY_USER} git -C "$APP_DIR" fetch origin
    sudo -u ${DEPLOY_USER} git -C "$APP_DIR" checkout "${BRANCH}" 2>/dev/null || sudo -u ${DEPLOY_USER} git -C "$APP_DIR" checkout -b "${BRANCH}" "origin/${BRANCH}"
    sudo -u ${DEPLOY_USER} git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
    success "Repository updated to latest origin/${BRANCH}."
else
    info "Cloning repository (you may be prompted for GitHub credentials)..."
    sudo -u ${DEPLOY_USER} git clone -b "${BRANCH}" "${REPO_URL}" "$APP_DIR"
    success "Repository cloned into ${APP_DIR}."
fi

# ─────────────────────────────────────────────────────────────
# STEP 10b: Fix Git Safe Directory & Permissions
# GOTCHA: Git refuses to operate in a directory owned by a
# different user. Both root and deploy user need this.
# ─────────────────────────────────────────────────────────────
info "Marking repo as safe directory for git..."
git config --global --add safe.directory "$APP_DIR"
sudo -u ${DEPLOY_USER} git config --global --add safe.directory "$APP_DIR"
success "Git safe.directory configured for root and ${DEPLOY_USER}."

# ─────────────────────────────────────────────────────────────
# STEP 11: Setup SSL Directory
# ─────────────────────────────────────────────────────────────
header "11/20  Setup SSL Directory"

mkdir -p /etc/ssl/cloudflare
success "Created /etc/ssl/cloudflare/"

# Download Cloudflare Origin Pull CA cert
if [[ ! -f /etc/ssl/cloudflare/cloudflare-origin-pull-ca.pem ]]; then
    info "Downloading Cloudflare Origin Pull CA certificate..."
    curl -so /etc/ssl/cloudflare/cloudflare-origin-pull-ca.pem \
        https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
    success "Cloudflare Origin Pull CA cert downloaded."
else
    warn "Cloudflare Origin Pull CA cert already exists."
fi

echo ""
warn "IMPORTANT: You still need to paste your Cloudflare Origin Certificate!"
echo -e "  ${CYAN}1. Go to Cloudflare Dashboard > SSL/TLS > Origin Server > Create Certificate${NC}"
echo -e "  ${CYAN}2. Paste certificate into: /etc/ssl/cloudflare/origin.pem${NC}"
echo -e "  ${CYAN}3. Paste private key into:  /etc/ssl/cloudflare/origin-key.pem${NC}"
echo -e "  ${CYAN}4. Run: chmod 600 /etc/ssl/cloudflare/origin-key.pem${NC}"
echo -e "  ${CYAN}5. Run: chmod 644 /etc/ssl/cloudflare/origin.pem${NC}"

# ─────────────────────────────────────────────────────────────
# STEP 12: Copy Nginx Configs
# ─────────────────────────────────────────────────────────────
header "12/20  Copy Nginx Configs"

info "Copying site config..."
cp "${APP_DIR}/deployment/nginx/strickersacademy.conf" /etc/nginx/sites-available/strickersacademy
ln -sf /etc/nginx/sites-available/strickersacademy /etc/nginx/sites-enabled/strickersacademy
success "Site config installed and symlinked."

info "Copying Cloudflare origin-pull snippet..."
mkdir -p /etc/nginx/snippets
cp "${APP_DIR}/deployment/nginx/cloudflare-origin-pull.conf" /etc/nginx/snippets/cloudflare-origin-pull.conf
success "Cloudflare origin-pull snippet installed."

# ─────────────────────────────────────────────────────────────
# STEP 13: Setup .env File
# ─────────────────────────────────────────────────────────────
header "13/20  Setup Environment File"

ENV_FILE="${APP_DIR}/server/.env"

if [[ -f "$ENV_FILE" ]]; then
    warn ".env file already exists at ${ENV_FILE}."
    ask "Overwrite? (y/N): "
    read -r OVERWRITE_ENV
    if [[ "$OVERWRITE_ENV" != "y" && "$OVERWRITE_ENV" != "Y" ]]; then
        info "Keeping existing .env file."
    else
        cp "${APP_DIR}/deployment/.env.production.example" "$ENV_FILE"
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" "$ENV_FILE"
        chown ${DEPLOY_USER}:${DEPLOY_USER} "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        success ".env file overwritten with DB credentials filled in."
    fi
else
    cp "${APP_DIR}/deployment/.env.production.example" "$ENV_FILE"
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" "$ENV_FILE"
    chown ${DEPLOY_USER}:${DEPLOY_USER} "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    success ".env file created with DATABASE_URL filled in."
fi

echo ""
warn "REMINDER: You still need to edit ${ENV_FILE} and fill in:"
echo -e "  ${CYAN}- JWT_SECRET         (random 64-char string)${NC}"
echo -e "  ${CYAN}- COOKIE_SECRET      (random 64-char string)${NC}"
echo -e "  ${CYAN}- RAZORPAY_KEY_ID    (from Razorpay dashboard)${NC}"
echo -e "  ${CYAN}- RAZORPAY_KEY_SECRET${NC}"
echo -e "  ${CYAN}- RAZORPAY_WEBHOOK_SECRET${NC}"

# ─────────────────────────────────────────────────────────────
# STEP 14: Install npm Dependencies
# GOTCHA: `npm ci` fails with TAR_ENTRY_ERROR / ENOTEMPTY if
# stale node_modules directories exist. Always clean first.
# GOTCHA: Do NOT use `--omit=dev` — TypeScript is a devDep
# needed for the build step.
# ─────────────────────────────────────────────────────────────
header "14/20  Install npm Dependencies"

cd "$APP_DIR"

info "Cleaning stale node_modules (prevents TAR_ENTRY_ERROR)..."
rm -rf node_modules server/node_modules client/node_modules shared/node_modules
success "Cleaned node_modules."

info "Running npm ci in ${APP_DIR}..."
sudo -u ${DEPLOY_USER} npm ci
success "npm dependencies installed (including devDeps for build)."

# ─────────────────────────────────────────────────────────────
# STEP 15: Prisma — Swap Provider & Push Schema
# GOTCHA: The repo uses sqlite for dev. Production needs postgresql.
#   - migration_lock.toml says sqlite, so `prisma migrate deploy` fails
#   - Solution: delete migrations dir, swap provider, use `prisma db push`
# GOTCHA: After every `git reset --hard`, schema reverts to sqlite.
#   The deploy script handles this automatically.
# ─────────────────────────────────────────────────────────────
header "15/20  Prisma — Swap Provider & Push Schema"

cd "$APP_DIR"

info "Swapping Prisma provider from sqlite to postgresql..."
sed -i 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma
success "Prisma provider set to postgresql."

info "Removing sqlite migrations (if any) to avoid lock mismatch..."
rm -rf server/prisma/migrations
success "Migrations directory removed."

info "Generating Prisma client..."
sudo -u ${DEPLOY_USER} npm run db:generate --workspace=server
success "Prisma client generated."

info "Pushing schema to database (prisma db push)..."
cd "${APP_DIR}/server"
sudo -u ${DEPLOY_USER} bash -c "export \$(grep -v '^#' .env | xargs) && npx prisma db push --accept-data-loss" 2>/dev/null \
  || sudo -u ${DEPLOY_USER} bash -c "export \$(grep -v '^#' .env | xargs) && npx prisma db push"
cd "$APP_DIR"
success "Database schema synced via prisma db push."

# ─────────────────────────────────────────────────────────────
# STEP 16: Build the App
# GOTCHA: Server tsconfig must exclude *.test.ts files.
# GOTCHA: Client tsconfig must exclude test files and needs
#   vite-env.d.ts for import.meta.env type support.
# GOTCHA: PM2 script path is dist/server/src/index.js (not
#   dist/index.js) because tsc outputs nested structure due to
#   shared workspace tsconfig include paths.
# ─────────────────────────────────────────────────────────────
header "16/20  Build the App"

cd "$APP_DIR"

info "Building shared package..."
sudo -u ${DEPLOY_USER} npm run build --workspace=shared
success "Shared package built."

info "Building server..."
sudo -u ${DEPLOY_USER} npm run build --workspace=server
success "Server built."

info "Building client..."
sudo -u ${DEPLOY_USER} npm run build --workspace=client
success "Client built."

# ─────────────────────────────────────────────────────────────
# STEP 17: Fix Permissions (CRITICAL)
# GOTCHA: Root runs this script, but deploy user runs PM2 and
# subsequent deploys. ALL these directories must be owned by
# the deploy user or you get EACCES errors everywhere.
# ─────────────────────────────────────────────────────────────
header "17/20  Fix Permissions"

info "Setting ownership for deploy user on all required directories..."
chown -R ${DEPLOY_USER}:${DEPLOY_USER} "$APP_DIR"
chown -R ${DEPLOY_USER}:${DEPLOY_USER} /var/log/pm2/
mkdir -p /home/${DEPLOY_USER}/.pm2/logs /home/${DEPLOY_USER}/.pm2/pids /home/${DEPLOY_USER}/.pm2/modules
chown -R ${DEPLOY_USER}:${DEPLOY_USER} /home/${DEPLOY_USER}/.pm2
mkdir -p /home/${DEPLOY_USER}/.npm
chown -R ${DEPLOY_USER}:${DEPLOY_USER} /home/${DEPLOY_USER}/.npm
success "Permissions fixed for: ${APP_DIR}, /var/log/pm2/, ~/.pm2, ~/.npm"

# ─────────────────────────────────────────────────────────────
# STEP 18: Start with PM2
# ─────────────────────────────────────────────────────────────
header "18/20  Start with PM2"

info "Starting app with PM2..."
cd "$APP_DIR"

if sudo -u ${DEPLOY_USER} pm2 describe strikers-api &>/dev/null; then
    sudo -u ${DEPLOY_USER} pm2 restart strikers-api
    success "PM2 process restarted."
else
    sudo -u ${DEPLOY_USER} pm2 start "${APP_DIR}/deployment/ecosystem.config.js"
    success "PM2 process started."
fi

sudo -u ${DEPLOY_USER} pm2 save
success "PM2 process list saved."

# Setup PM2 startup (generates the systemd command)
info "Setting up PM2 startup on boot..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u ${DEPLOY_USER} --hp /home/${DEPLOY_USER}
success "PM2 startup configured."

# ─────────────────────────────────────────────────────────────
# STEP 19: Reload Nginx & Health Check
# ─────────────────────────────────────────────────────────────
header "19/20  Nginx Reload & Health Check"

info "Testing Nginx configuration..."
if nginx -t 2>&1; then
    success "Nginx config is valid."
    systemctl reload nginx
    success "Nginx reloaded."
else
    error "Nginx config test failed! Check your SSL certs and config files."
    warn "Nginx will work once you install Cloudflare Origin certs (step 11)."
fi

echo ""
info "Running health check (curl localhost:5000/health)..."
sleep 3  # Give PM2 a moment to start the process

HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health 2>/dev/null || true)
if [[ "$HEALTH_RESPONSE" == "200" ]]; then
    success "Health check passed! API is responding on port 5000."
else
    warn "Health check returned HTTP ${HEALTH_RESPONSE:-'no response'}."
    warn "This may be expected if .env secrets are not yet configured."
    warn "Check logs with: sudo -u ${DEPLOY_USER} pm2 logs strikers-api"
fi

# ─────────────────────────────────────────────────────────────
# STEP 20: Database Backup Cron
# ─────────────────────────────────────────────────────────────
header "20/20  Database Backup Cron"

BACKUP_DIR="/var/backups/strikersacademy"
BACKUP_SCRIPT="${APP_DIR}/deployment/backup-db.sh"
BACKUP_LOG="/var/log/strikersacademy-backup.log"

info "Setting up daily database backup..."

# Create backup directory and log file
mkdir -p "$BACKUP_DIR"
touch "$BACKUP_LOG"
# GOTCHA: deploy user needs ownership of backup dir and log
chown -R ${DEPLOY_USER}:${DEPLOY_USER} "$BACKUP_DIR"
chown ${DEPLOY_USER}:${DEPLOY_USER} "$BACKUP_LOG"
success "Created ${BACKUP_DIR} and ${BACKUP_LOG} (owned by ${DEPLOY_USER})"

# Make scripts executable
chmod +x "${APP_DIR}/deployment/backup-db.sh"
chmod +x "${APP_DIR}/deployment/restore-db.sh"
success "Backup and restore scripts made executable."

# Setup .pgpass for passwordless pg_dump (root + deploy user)
# GOTCHA: Both root and deploy user need .pgpass for pg_dump to work
# without prompting for a password. The deploy user runs the cron
# job and GitHub Actions backup; root may run manual restores.
for PGPASS_HOME in "/root" "/home/${DEPLOY_USER}"; do
    PGPASS_FILE="${PGPASS_HOME}/.pgpass"
    if [[ ! -f "$PGPASS_FILE" ]]; then
        echo "127.0.0.1:5432:${DB_NAME}:${DB_USER}:${DB_PASSWORD}" > "$PGPASS_FILE"
        chmod 600 "$PGPASS_FILE"
        success "Created ${PGPASS_FILE} for passwordless pg_dump."
    else
        if ! grep -qF "${DB_NAME}:${DB_USER}" "$PGPASS_FILE"; then
            echo "127.0.0.1:5432:${DB_NAME}:${DB_USER}:${DB_PASSWORD}" >> "$PGPASS_FILE"
            success "Added entry to existing ${PGPASS_FILE}."
        else
            warn ".pgpass entry already exists in ${PGPASS_FILE}, skipping."
        fi
    fi
done
chown ${DEPLOY_USER}:${DEPLOY_USER} "/home/${DEPLOY_USER}/.pgpass"
success ".pgpass set up for both root and ${DEPLOY_USER}."

# Make scripts executable
chmod +x "${APP_DIR}/deployment/restore-from-gdrive.sh" 2>/dev/null || true
chmod +x "${APP_DIR}/deployment/setup-gdrive-backup.sh" 2>/dev/null || true

# Install cron job (idempotent)
CRON_ENTRY="0 0 * * * ${BACKUP_SCRIPT} >> ${BACKUP_LOG} 2>&1"
EXISTING_CRON=$(crontab -l 2>/dev/null || true)
if echo "$EXISTING_CRON" | grep -qF "backup-db.sh"; then
    warn "Backup cron job already exists, skipping."
else
    (echo "$EXISTING_CRON"; echo ""; echo "# StrikersAcademy daily DB backup at midnight IST"; echo "CRON_TZ=Asia/Kolkata"; echo "$CRON_ENTRY") | crontab -
    success "Installed cron job: daily at 00:00 IST (Asia/Kolkata)"
fi

# Run a test backup
info "Running test backup..."
if bash "$BACKUP_SCRIPT"; then
    success "Test backup completed successfully."
else
    warn "Test backup failed. Check PostgreSQL connectivity and credentials."
fi

success "Backup schedule: Every day at 00:00"
success "Backups stored in: ${BACKUP_DIR} (30-day retention)"
success "Restore with: sudo bash ${APP_DIR}/deployment/restore-db.sh"

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
header "Setup Complete!"

echo ""
echo -e "${GREEN}${BOLD}Credentials & Paths${NC}"
echo -e "─────────────────────────────────────────"
echo -e "  Deploy user:     ${BOLD}${DEPLOY_USER}${NC} (passwordless sudo)"
echo -e "  App directory:   ${BOLD}${APP_DIR}${NC}"
echo -e "  Branch:          ${BOLD}${BRANCH}${NC}"
echo -e "  DB name:         ${BOLD}${DB_NAME}${NC}"
echo -e "  DB user:         ${BOLD}${DB_USER}${NC}"
echo -e "  DB password:     ${BOLD}${DB_PASSWORD}${NC}"
echo -e "  DATABASE_URL:    ${BOLD}${DATABASE_URL}${NC}"
echo -e "  .env file:       ${BOLD}${ENV_FILE}${NC}"
echo -e "  Nginx config:    ${BOLD}/etc/nginx/sites-available/strickersacademy${NC}"
echo -e "  SSL certs dir:   ${BOLD}/etc/ssl/cloudflare/${NC}"
echo -e "  PM2 logs:        ${BOLD}/var/log/pm2/${NC}"
echo -e "  PM2 script:      ${BOLD}dist/server/src/index.js${NC} (nested tsc output)"
echo -e "  DB backups:      ${BOLD}/var/backups/strikersacademy/${NC} (daily at 00:00, 30-day retention)"
echo -e "  Backup log:      ${BOLD}/var/log/strikersacademy-backup.log${NC}"
echo ""

echo -e "${YELLOW}${BOLD}Next Steps (manual)${NC}"
echo -e "─────────────────────────────────────────"
echo -e "  ${YELLOW}1.${NC} Paste Cloudflare Origin Certificate:"
echo -e "     ${CYAN}sudo nano /etc/ssl/cloudflare/origin.pem${NC}"
echo -e "     ${CYAN}sudo nano /etc/ssl/cloudflare/origin-key.pem${NC}"
echo -e "     ${CYAN}sudo chmod 600 /etc/ssl/cloudflare/origin-key.pem${NC}"
echo -e "     ${CYAN}sudo chmod 644 /etc/ssl/cloudflare/origin.pem${NC}"
echo ""
echo -e "  ${YELLOW}2.${NC} Edit .env and fill in remaining secrets:"
echo -e "     ${CYAN}sudo -u ${DEPLOY_USER} nano ${ENV_FILE}${NC}"
echo -e "     Fill in: JWT_SECRET, COOKIE_SECRET, RAZORPAY keys"
echo ""
echo -e "  ${YELLOW}3.${NC} After updating certs and .env, restart everything:"
echo -e "     ${CYAN}sudo -u ${DEPLOY_USER} pm2 restart strikers-api${NC}"
echo -e "     ${CYAN}sudo nginx -t && sudo systemctl reload nginx${NC}"
echo ""
echo -e "  ${YELLOW}4.${NC} Configure Cloudflare Dashboard:"
echo -e "     - SSL/TLS mode: ${BOLD}Full (strict)${NC}"
echo -e "     - Authenticated Origin Pulls: ${BOLD}On${NC}  (REQUIRED or you get 400 errors)"
echo -e "     - Always Use HTTPS: ${BOLD}On${NC}"
echo -e "     - Delete ALL old/stale DNS A records (e.g. from GoDaddy)"
echo -e "     - See CICD-SETUP.md for full Cloudflare settings"
echo ""
echo -e "  ${YELLOW}5.${NC} Seed the database (optional, for initial data):"
echo -e "     ${CYAN}cd ${APP_DIR}/server${NC}"
echo -e "     ${CYAN}export \$(grep -v '^#' .env | xargs)${NC}"
echo -e "     ${CYAN}npx tsx prisma/seed.ts${NC}"
echo ""
echo -e "  ${YELLOW}6.${NC} For future deployments, run:"
echo -e "     ${CYAN}su - ${DEPLOY_USER}${NC}"
echo -e "     ${CYAN}cd ${APP_DIR} && bash deployment/deploy.sh${NC}"
echo ""

echo -e "${RED}${BOLD}Common Gotchas (see CICD-SETUP.md Troubleshooting for full list)${NC}"
echo -e "─────────────────────────────────────────"
echo -e "  - ${CYAN}npm ci TAR_ENTRY_ERROR${NC}: rm -rf node_modules first"
echo -e "  - ${CYAN}Prisma migrate deploy fails${NC}: Use prisma db push (already done above)"
echo -e "  - ${CYAN}Prisma client wrong provider after git reset${NC}: sed swap + prisma generate"
echo -e "  - ${CYAN}400 No SSL cert error${NC}: Enable Cloudflare Authenticated Origin Pulls"
echo -e "  - ${CYAN}Test API directly${NC}: curl http://localhost:5000/api/auth/me (skip Nginx SSL)"
echo -e "  - ${CYAN}Seed outside PM2${NC}: export \$(grep -v '^#' .env | xargs) first"
echo -e "  - ${CYAN}PM2 Script not found${NC}: Path is dist/server/src/index.js (not dist/index.js)"
echo ""

echo -e "${GREEN}${BOLD}Save the DB password shown above — it won't be displayed again.${NC}"
echo ""
