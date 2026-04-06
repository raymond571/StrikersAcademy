# StrikersAcademy — CI/CD & Infrastructure Setup Guide

Complete step-by-step guide to connect GitHub Actions, Hetzner VPS, and Cloudflare.
**Last updated:** 2026-04-06 (verified working deployment)

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

On your local machine (Windows — leave passphrase empty when prompted):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f github_deploy_key
```

When asked `Enter passphrase` — press **Enter** twice (empty).

Creates:
- `github_deploy_key` — private key (goes to GitHub)
- `github_deploy_key.pub` — public key (goes to VPS)

---

## Step 2: VPS User + SSH Key Setup

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

# Mark repo as safe directory
git config --global --add safe.directory /var/www/strickersacademy
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

**Delete any old/stale A records** (e.g. from GoDaddy). Keep ONLY:

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

**This is REQUIRED** — without it you get `400 No required SSL certificate was sent`.

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

```bash
cd /var/www/strickersacademy

# 1. Fix ownership (root ran setup, deploy user needs access)
chown -R deploy:deploy /var/www/strickersacademy
chown -R deploy:deploy /var/log/pm2/
chown -R deploy:deploy /home/deploy/.pm2
chown -R deploy:deploy /home/deploy/.npm

# 2. Clean install
rm -rf node_modules server/node_modules client/node_modules shared/node_modules
npm ci

# 3. Setup PostgreSQL schema (NOT migrations — we use db push)
sed -i 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma
cd server
rm -rf prisma/migrations
npx prisma db push
npx prisma generate
cd ..

# 4. Seed the database
cd server
export $(grep -v '^#' .env | xargs)
npx tsx prisma/seed.ts
cd ..

# 5. Build
npm run build --workspace=shared
npm run build --workspace=server
npm run build --workspace=client

# 6. Start PM2 as deploy user
sudo -u deploy pm2 start deployment/ecosystem.config.js
sudo -u deploy pm2 save
pm2 startup systemd

# 7. Reload Nginx
sudo nginx -t && sudo systemctl reload nginx
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
Stale `node_modules`. The deploy script now cleans these automatically. Manual fix:
```bash
rm -rf node_modules server/node_modules client/node_modules shared/node_modules
npm ci
```

### PM2 permission errors (EACCES)
PM2 directories owned by wrong user:
```bash
chown -R deploy:deploy /home/deploy/.pm2
chown -R deploy:deploy /var/log/pm2/
chown -R deploy:deploy /home/deploy/.npm
```

### npm cache permission error
```bash
mkdir -p /home/deploy/.npm
chown -R deploy:deploy /home/deploy/.npm
```

### Git "dubious ownership" error
```bash
git config --global --add safe.directory /var/www/strickersacademy
```

### Git "Permission denied" on fetch
```bash
chown -R deploy:deploy /var/www/strickersacademy
```

### Prisma "provider does not match migration_lock.toml"
SQLite migrations conflict with PostgreSQL. Already fixed — migrations removed from repo, deploy uses `prisma db push`.

### Prisma "DATABASE_URL not found" (seed/CLI)
When running prisma commands manually:
```bash
cd /var/www/strickersacademy/server
export $(grep -v '^#' .env | xargs)
npx tsx prisma/seed.ts
```

### Prisma client not initialized after git reset
`git reset --hard` reverts schema to sqlite. Deploy script fixes this automatically. Manual:
```bash
sed -i 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma
npx prisma generate --schema=server/prisma/schema.prisma
pm2 restart strikers-api
```

### PM2 "Script not found: dist/index.js"
tsc outputs to `dist/server/src/` due to shared workspace include. Already fixed in `ecosystem.config.js` (`script: 'dist/server/src/index.js'`).

### `400 No required SSL certificate was sent`
Enable in Cloudflare: SSL/TLS > Origin Server > **Authenticated Origin Pulls > ON**

Test API directly (bypasses Nginx SSL):
```bash
curl http://localhost:5000/api/auth/me
```

### DNS pointing to wrong IP
Delete stale A records in Cloudflare. Check VPS IP:
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

### Deploy succeeds but site shows old version
Clear browser cache or check in incognito. Verify PM2 restarted:
```bash
pm2 logs strikers-api --lines 10
```
