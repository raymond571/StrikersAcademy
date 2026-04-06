# StrikersAcademy — Production Deployment Guide

Domain: **strickersacademy.in**
Stack: Fastify (Node.js) + React + PostgreSQL
Hosting: Hetzner VPS + Cloudflare (SSL termination)

> **Template-ready:** This document captures every issue found during real deployment.
> Search for "GOTCHA" to find all hard-won lessons.
> For CI/CD pipeline details, see `CICD-SETUP.md`.

---

## 1. Hetzner VPS Initial Setup

### 1.1 Create the server

- Hetzner Cloud > Create Server > **Ubuntu 22.04** (CX21 or higher)
- Note the public IPv4 address (e.g., `5.78.x.x`)

### 1.2 First-time SSH login

```bash
ssh root@YOUR_VPS_IP

# Create a deploy user
adduser deploy
usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

# Disable root SSH login (optional, recommended)
sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### 1.3 Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Cloudflare -> origin)
ufw allow 443/tcp   # HTTPS (Cloudflare -> origin)
ufw enable
ufw status
```

Only ports **22**, **80**, and **443** should be open.

### 1.4 System updates

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential unzip
```

---

## 2. Cloudflare DNS Setup

### 2.1 Add the domain

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > Add Site > `strickersacademy.in`
2. Select the **Free** plan.

### 2.2 DNS records

**GOTCHA:** Delete ALL old/stale A records from previous hosting (e.g. GoDaddy). Stale records cause intermittent routing to the wrong server.

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `YOUR_VPS_IP` | Proxied (orange cloud) |
| CNAME | `www` | `strickersacademy.in` | Proxied (orange cloud) |

### 2.3 Update nameservers

Update your domain registrar's nameservers to the ones Cloudflare provides (e.g., `ada.ns.cloudflare.com`, `lee.ns.cloudflare.com`).

---

## 3. Cloudflare Origin Certificate

This certificate encrypts traffic between Cloudflare and your VPS.

### 3.1 Generate the certificate

1. Cloudflare Dashboard > SSL/TLS > Origin Server > **Create Certificate**
2. Settings:
   - Key type: **RSA (2048)**
   - Hostnames: `strickersacademy.in`, `*.strickersacademy.in`
   - Validity: **15 years**
3. Copy the **Origin Certificate** and **Private Key**.

### 3.2 Install on VPS

```bash
sudo mkdir -p /etc/ssl/cloudflare

# Paste the certificate
sudo nano /etc/ssl/cloudflare/origin.pem

# Paste the private key
sudo nano /etc/ssl/cloudflare/origin-key.pem

# Restrict permissions
sudo chmod 600 /etc/ssl/cloudflare/origin-key.pem
sudo chmod 644 /etc/ssl/cloudflare/origin.pem
```

### 3.3 Authenticated Origin Pulls (REQUIRED)

**GOTCHA:** This is NOT optional. Without it, every request through Cloudflare returns `400 No required SSL certificate was sent`.

Download the Cloudflare Origin Pull CA certificate:

```bash
sudo curl -o /etc/ssl/cloudflare/cloudflare-origin-pull-ca.pem \
  https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
```

Then enable in Cloudflare Dashboard > SSL/TLS > Origin Server > **Authenticated Origin Pulls > On**.

**GOTCHA:** When Authenticated Origin Pulls is ON, curling `https://strickersacademy.in` from the VPS itself returns 400. This is expected — test the API directly:
```bash
curl http://localhost:5000/api/auth/me
```

---

## 4. Install & Configure Nginx

### 4.1 Install

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 4.2 Deploy config files

```bash
# Copy the main site config
sudo cp deployment/nginx/strickersacademy.conf /etc/nginx/sites-available/strickersacademy
sudo ln -sf /etc/nginx/sites-available/strickersacademy /etc/nginx/sites-enabled/strickersacademy

# Copy the Cloudflare origin-pull snippet
sudo mkdir -p /etc/nginx/snippets
sudo cp deployment/nginx/cloudflare-origin-pull.conf /etc/nginx/snippets/cloudflare-origin-pull.conf

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 4.3 Nginx notes

- **Static files:** Nginx serves the React SPA from `/var/www/strickersacademy/client/dist`
- **API proxy:** `/api/*` routes are proxied to `localhost:5000` (Fastify)
- **Local testing:** Use `curl http://localhost:5000/api/auth/me` (not HTTPS, which requires Cloudflare's client cert)

### 4.4 Create log directory

```bash
sudo mkdir -p /var/log/pm2
sudo chown deploy:deploy /var/log/pm2
```

---

## 5. Install Node.js, PM2, PostgreSQL

### 5.1 Node.js (v20 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # should show v20.x
```

### 5.2 PM2

```bash
sudo npm install -g pm2
pm2 startup  # follow the printed command to enable auto-start on boot
```

**GOTCHA:** PM2 script path is `dist/server/src/index.js` (not `dist/index.js`). This is because tsc outputs a nested directory structure when the server tsconfig includes shared workspace paths. Already configured in `deployment/ecosystem.config.js`.

### 5.3 PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<SQL
CREATE USER strikers_user WITH PASSWORD 'CHANGE_ME_PASSWORD';
CREATE DATABASE strikersacademy OWNER strikers_user;
GRANT ALL PRIVILEGES ON DATABASE strikersacademy TO strikers_user;
SQL
```

**GOTCHA:** Set up `.pgpass` for passwordless `pg_dump` (needed for backups):
```bash
# For root
echo "127.0.0.1:5432:strikersacademy:strikers_user:YOUR_DB_PASSWORD" > /root/.pgpass
chmod 600 /root/.pgpass

# For deploy user
echo "127.0.0.1:5432:strikersacademy:strikers_user:YOUR_DB_PASSWORD" > /home/deploy/.pgpass
chmod 600 /home/deploy/.pgpass
chown deploy:deploy /home/deploy/.pgpass
```

---

## 6. Deploy the App

### 6.1 Clone the repository

```bash
sudo mkdir -p /var/www/strickersacademy
sudo chown deploy:deploy /var/www/strickersacademy

su - deploy
git clone https://github.com/raymond571/StrikersAcademy.git /var/www/strickersacademy
cd /var/www/strickersacademy
```

**GOTCHA:** Mark repo as safe directory for both root and deploy user:
```bash
git config --global --add safe.directory /var/www/strickersacademy
```

### 6.2 Fix permissions

**GOTCHA:** The deploy user needs ownership of ALL these directories, or you will get EACCES errors during deploys, PM2 operations, and backups:

```bash
# As root:
chown -R deploy:deploy /var/www/strickersacademy
chown -R deploy:deploy /var/log/pm2/
mkdir -p /home/deploy/.pm2/logs /home/deploy/.pm2/pids /home/deploy/.pm2/modules
chown -R deploy:deploy /home/deploy/.pm2
mkdir -p /home/deploy/.npm
chown -R deploy:deploy /home/deploy/.npm
mkdir -p /var/backups/strikersacademy
chown -R deploy:deploy /var/backups/strikersacademy
touch /var/log/strikersacademy-backup.log
chown deploy:deploy /var/log/strikersacademy-backup.log
```

### 6.3 Configure environment

```bash
cp deployment/.env.production.example server/.env
nano server/.env
# Fill in: DATABASE_URL, JWT_SECRET, COOKIE_SECRET, RAZORPAY keys
```

### 6.4 First deployment

**Option A: Run the automated setup script (recommended for fresh VPS):**
```bash
# As root:
cd /var/www/strickersacademy
bash deployment/setup-vps.sh
```

**Option B: Run deploy.sh directly (if setup-vps.sh was already run):**
```bash
# As deploy user:
cd /var/www/strickersacademy
bash deployment/deploy.sh
```

### 6.5 What deploy.sh does (and the gotchas it handles)

1. **git fetch + reset** (skipped with `--skip-pull` for GitHub Actions)
2. **sed swap** Prisma provider from sqlite to postgresql
   - **GOTCHA:** `git reset --hard` reverts schema.prisma to sqlite every time
3. **rm -rf node_modules** then **npm ci** (full install)
   - **GOTCHA:** Stale node_modules cause `TAR_ENTRY_ERROR` on npm ci
   - **GOTCHA:** Do NOT use `--omit=dev` — TypeScript is a devDependency needed for build
4. **prisma generate** — regenerate client for postgresql
   - **GOTCHA:** Must regenerate after every git reset (client is stale/wrong provider)
5. **prisma db push** — sync schema to database
   - **GOTCHA:** Do NOT use `prisma migrate deploy` — migration_lock.toml says sqlite, causing provider mismatch
6. **Build** shared > server > client
   - **GOTCHA:** Server tsconfig must exclude `*.test.ts` or build fails on test dependencies
   - **GOTCHA:** Client tsconfig must exclude test files and needs `vite-env.d.ts` for `import.meta.env`
7. **PM2 restart** + **Nginx reload**

### 6.6 Seed the database (optional)

**GOTCHA:** When running Prisma/seed commands manually (outside PM2), the .env file is not auto-loaded:
```bash
cd /var/www/strickersacademy/server
export $(grep -v '^#' .env | xargs)
npx tsx prisma/seed.ts
```

**Seed credentials:**

| Role | Phone | Password |
|------|-------|----------|
| Admin | `9000000001` | `admin123` |
| Staff | `9000000002` | `staff123` |
| Customer | `9876543210` | `test123` |

### 6.7 Verify

```bash
# Check PM2
pm2 status
pm2 logs strikers-api --lines 20

# Check API health (use localhost, not HTTPS — see Nginx gotcha)
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/api/auth/me

# Check Nginx
sudo nginx -t

# Check from outside (via Cloudflare)
# Use a browser: https://strickersacademy.in
```

---

## 7. Cloudflare Settings

Configure these in the Cloudflare Dashboard:

### SSL/TLS

| Setting | Value |
|---------|-------|
| SSL/TLS encryption mode | **Full (strict)** |
| Authenticated Origin Pulls | **On** (REQUIRED) |
| Always Use HTTPS | **On** |
| Minimum TLS Version | **1.2** |
| TLS 1.3 | **On** |
| Automatic HTTPS Rewrites | **On** |

### Security > HSTS

| Setting | Value |
|---------|-------|
| Enable HSTS | **On** |
| Max-Age | **6 months** (or 12) |
| Include subdomains | **On** |
| Preload | **On** |
| No-Sniff | **On** |

### Speed > Optimization

| Setting | Value |
|---------|-------|
| Auto Minify (JS, CSS, HTML) | **On** |
| Brotli | **On** |
| Early Hints | **On** |

### Caching

| Setting | Value |
|---------|-------|
| Caching Level | **Standard** |
| Browser Cache TTL | **4 hours** |

### Page Rules (optional)

| URL Pattern | Setting |
|-------------|---------|
| `strickersacademy.in/api/*` | Cache Level: Bypass |

---

## 8. Ongoing Maintenance

### Re-deploy after code changes

```bash
su - deploy
cd /var/www/strickersacademy
bash deployment/deploy.sh
```

Or push to `master` for automatic CI/CD deployment.

### View logs

```bash
pm2 logs strikers-api
sudo tail -f /var/log/nginx/strickersacademy.access.log
sudo tail -f /var/log/nginx/strickersacademy.error.log
```

### Renew Origin Certificate

Cloudflare Origin certificates last 15 years. If you need to renew:

1. Generate a new certificate in Cloudflare Dashboard
2. Replace `/etc/ssl/cloudflare/origin.pem` and `/etc/ssl/cloudflare/origin-key.pem`
3. `sudo systemctl reload nginx`

### Database backup

Automated via cron job (daily at midnight IST) and GitHub Actions workflow.
See `CICD-SETUP.md` for backup/restore workflow details.

```bash
# Manual backup
bash deployment/backup-db.sh

# Manual restore (latest)
bash deployment/restore-db.sh

# List backups
ls -la /var/backups/strikersacademy/
```

---

## 9. Complete Gotcha Reference

All issues discovered during real deployment, collected in one place:

### npm / Node.js
| Issue | Solution |
|-------|----------|
| `npm ci` TAR_ENTRY_ERROR / ENOTEMPTY | `rm -rf node_modules server/node_modules client/node_modules shared/node_modules` before install |
| Build fails with `--omit=dev` | Do NOT use `--omit=dev` — TypeScript is a devDependency needed for build |

### Prisma / Database
| Issue | Solution |
|-------|----------|
| `provider does not match migration_lock.toml` | Delete `server/prisma/migrations/` dir; use `prisma db push` not `prisma migrate deploy` |
| Prisma client wrong provider after `git reset` | `sed -i 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma` then `prisma generate` |
| `DATABASE_URL not found` when running seed | `export $(grep -v '^#' .env | xargs)` before running commands outside PM2 |
| pg_dump prompts for password | Set up `.pgpass` for both root and deploy user |

### Git / Permissions
| Issue | Solution |
|-------|----------|
| Git "dubious ownership" error | `git config --global --add safe.directory /var/www/strickersacademy` (both root and deploy user) |
| Permission denied on git fetch/deploy | `chown -R deploy:deploy /var/www/strickersacademy` |
| PM2 EACCES errors | `chown -R deploy:deploy /home/deploy/.pm2 /var/log/pm2/ /home/deploy/.npm` |
| Backup permission denied | `chown -R deploy:deploy /var/backups/strikersacademy /var/log/strikersacademy-backup.log` |

### Build / TypeScript
| Issue | Solution |
|-------|----------|
| PM2 "Script not found: dist/index.js" | Path is `dist/server/src/index.js` (tsc nested output from shared workspace) |
| Server build includes test files | Exclude `*.test.ts` in server tsconfig |
| Client `import.meta.env` type errors | Add `vite-env.d.ts` to client, exclude test files from client tsconfig |

### Cloudflare / Nginx / SSL
| Issue | Solution |
|-------|----------|
| `400 No required SSL certificate` | Enable Cloudflare Authenticated Origin Pulls (REQUIRED) |
| Local curl to HTTPS returns 400 | Expected with Auth Origin Pulls — test on `http://localhost:5000` instead |
| DNS routing to wrong server | Delete ALL old A records from previous hosting (GoDaddy etc) |

### CI/CD / GitHub Actions
| Issue | Solution |
|-------|----------|
| Windows `ssh-keygen -N ""` fails | Press Enter for empty passphrase instead of using `-N ""` flag |
| Deploy user must exist first | Create deploy user before adding SSH key to authorized_keys |
| `workflow_dispatch` not showing | Default branch must be `master` (not a feature branch) |
| CI not callable as reusable workflow | Add `workflow_call:` trigger to ci.yml |
| Backup/restore workflows not discovered | Add `push:` trigger so GitHub sees them on default branch |
| Deploy SSH action times out | Add `command_timeout: 10m` to appleboy/ssh-action |
