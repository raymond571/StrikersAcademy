# StrikersAcademy — CI/CD & Infrastructure Setup Guide

Complete step-by-step guide to connect GitHub Actions, Hetzner VPS, and Cloudflare.
**Last updated:** 2026-04-06 (verified working deployment)

> **Template-ready:** This document captures every issue found during real deployment.
> Search for "GOTCHA" to find all hard-won lessons.

---

## Prerequisites

- [x] Hetzner VPS IP address
- [x] Cloudflare DNS configured for `strickersacademy.in`
- [x] GitHub repo: `raymond571/StrikersAcademy`

---

## Security: Public Repo + Secrets

The GitHub repo is **public**. This is fine because:

1. **GitHub Secrets are encrypted** — never exposed in logs, PRs, or forks
2. **`.env` files are gitignored** — credentials never committed
3. **Deploy uses SSH** — VPS credentials in GitHub Secrets, not in code
4. **Razorpay, DB passwords, JWT secrets** — all in GitHub Environment Secrets

**What to NEVER do:**
- Never commit `.env` files (already in `.gitignore`)
- Never hardcode production credentials in source code
- Never paste secrets in PR descriptions or commit messages

**For extra security:** Make the repo **private** at Settings > General > Danger Zone > Change visibility.

---

## Step 1: Generate SSH Deploy Key

On your local machine (Windows):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f github_deploy_key
```

**GOTCHA (Windows):** The `-N ""` flag does NOT work on Windows `ssh-keygen`. When asked `Enter passphrase`, just press **Enter** twice for empty passphrase.

Creates:
- `github_deploy_key` — private key (goes to GitHub)
- `github_deploy_key.pub` — public key (goes to VPS)

---

## Step 2: VPS User + SSH Key Setup

**GOTCHA:** The deploy user must exist BEFORE you try to add the SSH key.

```bash
ssh root@<YOUR_VPS_IP>

# Create deploy user (skip if already exists)
adduser --disabled-password --gecos "Deploy User" deploy
usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

# Add SSH key
mkdir -p /home/deploy/.ssh
echo "<paste contents of github_deploy_key.pub>" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# Fix permissions for PM2 and npm (CRITICAL for CI/CD)
mkdir -p /home/deploy/.pm2/logs /home/deploy/.pm2/pids /home/deploy/.pm2/modules
mkdir -p /home/deploy/.npm
chown -R deploy:deploy /home/deploy/.pm2
chown -R deploy:deploy /home/deploy/.npm
chown -R deploy:deploy /var/log/pm2/

# GOTCHA: deploy user needs ownership of app dir, backup dir, and log
chown -R deploy:deploy /var/www/strickersacademy
chown -R deploy:deploy /var/backups/strikersacademy
chown deploy:deploy /var/log/strikersacademy-backup.log

# GOTCHA: Git "dubious ownership" error if repo owned by different user
git config --global --add safe.directory /var/www/strickersacademy
sudo -u deploy git config --global --add safe.directory /var/www/strickersacademy
```

Test: `ssh -i github_deploy_key deploy@<YOUR_VPS_IP> "echo connected"`

---

## Step 3: GitHub Repository Secrets

Go to: https://github.com/raymond571/StrikersAcademy/settings/secrets/actions

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your Hetzner VPS IPv4 (e.g. `46.62.236.207`) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Entire `github_deploy_key` file contents (private key, with BEGIN/END lines) |

---

## Step 4: "production" GitHub Environment

Go to: https://github.com/raymond571/StrikersAcademy/settings/environments

1. **New environment** > name: `production`
2. **Deployment branches** > Selected branches > add `master`
3. Add **Environment secrets**:

| Secret | Value | How to generate |
|--------|-------|-----------------|
| `DATABASE_URL` | `postgresql://strikers_user:DB_PASS@127.0.0.1:5432/strikersacademy?schema=public` | Use password from VPS setup |
| `JWT_SECRET` | 64-char random | `openssl rand -hex 32` |
| `COOKIE_SECRET` | 64-char random | `openssl rand -hex 32` |
| `CLIENT_URL` | `https://strickersacademy.in` | |
| `RAZORPAY_KEY_ID` | `rzp_live_XXXX` or test key for now | Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | Live or test secret | Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret | Razorpay dashboard > Webhooks |

---

## Step 5: "development" GitHub Environment (Optional)

Same page, **New environment** > `development`, branches > `develop`

Use test Razorpay keys (`rzp_test_*`) and different JWT/Cookie secrets.

---

## Step 6: Cloudflare SSL & DNS

### 6a. DNS Records

**GOTCHA:** Delete any old/stale A records (e.g. from GoDaddy or previous hosting). Keep ONLY the VPS IP. Stale records cause intermittent routing failures.

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `YOUR_VPS_IPV4` | Proxied |
| CNAME | `www` | `strickersacademy.in` | Proxied |

### 6b. SSL Mode

SSL/TLS > Overview > **Full (Strict)**

### 6c. Origin Certificate

SSL/TLS > Origin Server > **Create Certificate** > copy cert + key

On VPS:
```bash
sudo nano /etc/ssl/cloudflare/origin.pem       # paste certificate
sudo nano /etc/ssl/cloudflare/origin-key.pem    # paste private key
sudo chmod 644 /etc/ssl/cloudflare/origin.pem
sudo chmod 600 /etc/ssl/cloudflare/origin-key.pem
```

### 6d. Authenticated Origin Pulls

SSL/TLS > Origin Server > **Authenticated Origin Pulls > ON**

**GOTCHA: This is REQUIRED** — without it you get `400 No required SSL certificate was sent` on every request through Cloudflare.

**GOTCHA:** When Authenticated Origin Pulls is ON, `curl https://strickersacademy.in` from the VPS itself will also get 400. This is expected. Test the API directly:
```bash
curl http://localhost:5000/api/auth/me
# Expected: {"success":false,"error":"Unauthorised — please log in","statusCode":401}
```

### 6e. Edge Settings

SSL/TLS > Edge Certificates:
- Always Use HTTPS: **ON**
- Automatic HTTPS Rewrites: **ON**
- Minimum TLS Version: **1.2**

---

## Step 7: First-time VPS Setup

```bash
ssh root@<YOUR_VPS_IP>

# Clone repo
git clone https://github.com/raymond571/StrikersAcademy.git /var/www/strickersacademy
git config --global --add safe.directory /var/www/strickersacademy

# Run automated setup (installs Node, PostgreSQL, Nginx, PM2, backup cron)
cd /var/www/strickersacademy
bash deployment/setup-vps.sh
```

### After setup-vps.sh:

The script now handles all of these steps automatically:
- Cleans node_modules before npm ci (prevents TAR_ENTRY_ERROR)
- Swaps Prisma provider from sqlite to postgresql
- Deletes sqlite migrations and uses `prisma db push`
- Fixes permissions for deploy user
- Sets up .pgpass for passwordless pg_dump
- Configures git safe.directory

**Manual steps remaining after the script:**

```bash
cd /var/www/strickersacademy

# 1. Paste Cloudflare Origin Certificate (if not done yet)
sudo nano /etc/ssl/cloudflare/origin.pem
sudo nano /etc/ssl/cloudflare/origin-key.pem
sudo chmod 600 /etc/ssl/cloudflare/origin-key.pem
sudo chmod 644 /etc/ssl/cloudflare/origin.pem

# 2. Edit .env and fill in remaining secrets (if not done yet)
sudo -u deploy nano server/.env
# Fill in: JWT_SECRET, COOKIE_SECRET, RAZORPAY keys

# 3. Restart after updating certs and .env
sudo -u deploy pm2 restart strikers-api
sudo nginx -t && sudo systemctl reload nginx

# 4. (Optional) Seed the database
cd server
export $(grep -v '^#' .env | xargs)
npx tsx prisma/seed.ts
cd ..
```

### Verify:
```bash
curl http://localhost:5000/api/auth/me
# Expected: {"success":false,"error":"Unauthorised — please log in","statusCode":401}
```

Visit https://strickersacademy.in

**Seed credentials:**

| Role | Phone | Password |
|------|-------|----------|
| Admin | `9000000001` | `admin123` |
| Staff | `9000000002` | `staff123` |
| Customer | `9876543210` | `test123` |

---

## Step 8: CI/CD — How It Works

### Automatic Deployment

1. **Push to `master`** > CI tests > deploy to **production**
2. **Push to `develop`** > CI tests > deploy to **development**
3. **Pull requests** > CI tests only (no deploy)

### Manual Deployment

Actions tab > **Deploy** > **Run workflow** > pick environment > **Run**

**GOTCHA:** The default branch must be `master` (not a feature branch like `phase-4`) for `workflow_dispatch` to show in the Actions UI.

### Pipeline Flow

```
Push to master
    |
    v
CI (.github/workflows/ci.yml)
    |- npm ci
    |- Build shared types
    |- Generate Prisma client
    |- Run server tests (95 tests)
    |
    v (if tests pass)
Deploy (.github/workflows/deploy.yml)
    |- SSH into VPS as deploy user
    |- git fetch + reset --hard
    |- Write server/.env from GitHub Secrets
    |- Write client/.env (VITE_ build vars)
    |- deploy.sh --skip-pull:
         |- Swap Prisma provider to postgresql
         |- rm -rf node_modules (clean slate)
         |- npm ci (full install, includes devDeps for build)
         |- prisma generate
         |- prisma db push (sync schema)
         |- Build shared > server > client
         |- PM2 restart
         |- Nginx reload
```

### GitHub Actions Workflow Gotchas

| Issue | Fix |
|-------|-----|
| CI workflow not callable from deploy | Add `workflow_call:` trigger to ci.yml so deploy.yml can use it as a reusable workflow |
| Backup/restore workflows not visible | Add `push:` trigger (not just `schedule`/`workflow_dispatch`). GitHub must see the workflow file on the default branch via a push event to discover it |
| `workflow_dispatch` not showing in UI | Default branch must be `master`. If your default is a feature branch, the button won't appear |
| Deploy times out | Add `command_timeout: 10m` to the SSH action. npm ci + full build can take 5+ minutes |
| SSH auth fails | Verify `VPS_SSH_KEY` is the **private** key (not `.pub`), public key is in `/home/deploy/.ssh/authorized_keys` |

---

## Architecture

```
User Browser
    |
    v
Cloudflare (DNS + SSL + CDN + Auth Origin Pull)
    |
    v
Nginx (port 443, reverse proxy + static files)
    |- /api/* --> proxy to localhost:5000 (Fastify)
    |- /*     --> serve /client/dist/ (React SPA)
    |
    v
PM2 > Fastify (port 5000, localhost only)
    |
    v
PostgreSQL (port 5432, localhost only)
```

**Nginx notes:**
- Static files served from `/var/www/strickersacademy/client/dist`
- Cloudflare Authenticated Origin Pulls causes "400 No required SSL certificate" when curling locally via HTTPS — this is expected, test API directly on port 5000

---

## Backup & Restore Pipelines

### Automatic Daily Backup

A GitHub Actions workflow runs daily at **00:00 IST** (18:30 UTC):
- SSHs into VPS and runs `backup-db.sh`
- Creates a compressed PostgreSQL dump in `/var/backups/strikersacademy/`
- Uploads to Google Drive (if rclone is configured)
- 30-day retention on both local and Google Drive

Also runs via the VPS cron job as a redundant backup.

### Manual Backup

Go to: Actions > **Database Backup** > **Run workflow** > optionally add a reason > **Run**

### Manual Restore

Go to: Actions > **Database Restore** > **Run workflow**:
- **backup_file**: leave empty for latest, or enter a specific filename
- **confirm**: type `RESTORE` (safety check — this replaces the entire database)

The workflow:
1. Finds the backup file on VPS
2. Stops PM2
3. Drops and recreates the database
4. Restores from the backup
5. Restarts PM2

### Google Drive Backup (Optional — setup later)

Backs up to Google Drive for disaster recovery. One-time setup on VPS:

```bash
sudo bash /var/www/strickersacademy/deployment/setup-gdrive-backup.sh
```

This installs `rclone` and guides through Google Drive authentication.
After setup, daily backups auto-upload to `StrikersAcademy-Backups/` on Google Drive.

**Disaster recovery from Google Drive (fresh VPS):**
```bash
# 1. Install rclone
curl https://rclone.org/install.sh | sudo bash

# 2. Configure rclone (add 'gdrive' remote with your Google account)
rclone config

# 3. List available backups
bash deployment/restore-from-gdrive.sh --list

# 4. Restore latest backup
bash deployment/restore-from-gdrive.sh

# 5. Run full VPS setup
bash deployment/setup-vps.sh
```

---

## Branch Strategy

| Branch | Environment | Trigger | Razorpay |
|--------|-------------|---------|----------|
| `master` | production | Auto on push | Live keys |
| `develop` | development | Auto on push | Test keys |
| Feature branches | -- | CI only | -- |

---

## Troubleshooting

### `npm ci` fails with TAR_ENTRY_ERROR / ENOTEMPTY
**GOTCHA:** Stale `node_modules` directories. The deploy script now cleans these automatically. Manual fix:
```bash
rm -rf node_modules server/node_modules client/node_modules shared/node_modules
npm ci
```

### `npm ci --omit=dev` breaks the build
**GOTCHA:** TypeScript is a devDependency. If you omit dev dependencies, `tsc` is not available and the build fails. Always use `npm ci` without `--omit=dev`.

### PM2 permission errors (EACCES)
PM2 directories owned by wrong user:
```bash
chown -R deploy:deploy /home/deploy/.pm2
chown -R deploy:deploy /var/log/pm2/
chown -R deploy:deploy /home/deploy/.npm
chown -R deploy:deploy /var/www/strickersacademy
```

### npm cache permission error
```bash
mkdir -p /home/deploy/.npm
chown -R deploy:deploy /home/deploy/.npm
```

### Git "dubious ownership" error
**GOTCHA:** Happens when root cloned the repo but deploy user runs git operations.
```bash
git config --global --add safe.directory /var/www/strickersacademy
# Run as BOTH root and deploy user:
sudo -u deploy git config --global --add safe.directory /var/www/strickersacademy
```

### Git "Permission denied" on fetch
```bash
chown -R deploy:deploy /var/www/strickersacademy
```

### Prisma "provider does not match migration_lock.toml"
**GOTCHA:** The repo uses sqlite for dev. migration_lock.toml says sqlite, but production uses postgresql. Solution: delete the migrations directory entirely and use `prisma db push` instead of `prisma migrate deploy`. The deploy script handles this automatically.

### Prisma "DATABASE_URL not found" (seed/CLI)
**GOTCHA:** When running Prisma commands manually (outside PM2), the .env file is not auto-loaded. You must export the variables first:
```bash
cd /var/www/strickersacademy/server
export $(grep -v '^#' .env | xargs)
npx tsx prisma/seed.ts
```

### Prisma client not initialized after git reset
**GOTCHA:** `git reset --hard` reverts schema.prisma to sqlite provider. The generated Prisma client is now wrong. Deploy script fixes this automatically. Manual fix:
```bash
sed -i 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma
npx prisma generate --schema=server/prisma/schema.prisma
pm2 restart strikers-api
```

### PM2 "Script not found: dist/index.js"
**GOTCHA:** tsc outputs to `dist/server/src/` (not `dist/`) because the server tsconfig includes shared workspace paths. Already fixed in `ecosystem.config.js` — script is set to `dist/server/src/index.js`.

### Server tsconfig build includes test files
**GOTCHA:** Server tsconfig must exclude `*.test.ts` files from the build, or tsc will try to compile test files that import test-only dependencies (vitest, etc). Fix: add `"exclude": ["**/*.test.ts", "**/*.spec.ts"]` to server/tsconfig.json.

### Client tsconfig / Vite type errors
**GOTCHA:** Client tsconfig must exclude test files and needs a `vite-env.d.ts` file for `import.meta.env` type support. Without it, TypeScript does not know about Vite's environment variable types.

### `400 No required SSL certificate was sent`
**GOTCHA:** Enable in Cloudflare: SSL/TLS > Origin Server > **Authenticated Origin Pulls > ON**

When this is ON, curling `https://strickersacademy.in` from the VPS itself will also get 400. This is expected — Cloudflare requires the client certificate which only Cloudflare's edge servers have.

Test API directly (bypasses Nginx SSL):
```bash
curl http://localhost:5000/api/auth/me
```

### DNS pointing to wrong IP
**GOTCHA:** Delete ALL stale A records in Cloudflare (e.g. old GoDaddy records). Keep only the VPS IP.
```bash
curl -4 -s ifconfig.me
```

### TypeScript build errors on VPS but not locally
All `$transaction` callbacks need `(tx: TxClient)`. All `.map/.some/.reduce` callbacks need explicit types under `strict: true`.

### Site shows 502 Bad Gateway
```bash
pm2 status
pm2 logs strikers-api --lines 30
ss -tlnp | grep 5000
```

### SSH authentication fails in GitHub Actions
- Verify `VPS_SSH_KEY` is the **private** key (not `.pub`)
- Verify public key is in `/home/deploy/.ssh/authorized_keys`
- Test locally: `ssh -i github_deploy_key deploy@<VPS_IP> "echo ok"`
- Check firewall: `sudo ufw status` (port 22 must be open)
- **GOTCHA (Windows):** `ssh-keygen` on Windows does not accept `-N ""` for empty passphrase. Just press Enter when prompted.

### Deploy times out in GitHub Actions
**GOTCHA:** Add `command_timeout: 10m` to the appleboy/ssh-action step. npm ci + full build can easily exceed the default timeout.

### Deploy succeeds but site shows old version
Clear browser cache or check in incognito. Verify PM2 restarted:
```bash
pm2 logs strikers-api --lines 10
```

### Backup/restore workflows not showing in Actions tab
**GOTCHA:** GitHub only discovers workflow files when they are pushed to the default branch. If you created the workflow on a feature branch, you need a `push:` trigger (not just `schedule`/`workflow_dispatch`) so GitHub sees the file when it lands on master.

### pg_dump prompts for password during backup
**GOTCHA:** Both root and deploy user need a `.pgpass` file for passwordless pg_dump:
```bash
# For each user (/root/.pgpass and /home/deploy/.pgpass):
echo "127.0.0.1:5432:strikersacademy:strikers_user:YOUR_DB_PASSWORD" > ~/.pgpass
chmod 600 ~/.pgpass
```
