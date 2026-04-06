# StrikersAcademy — CI/CD & Infrastructure Setup Guide

Complete step-by-step guide to connect GitHub Actions, Hetzner VPS, and Cloudflare.

---

## Prerequisites

- [x] Hetzner VPS IP address
- [x] Cloudflare DNS configured for `strickersacademy.in`
- [x] GitHub repo: `raymond571/StrikersAcademy`

---

## Security: Public Repo + Secrets

The GitHub repo is **public**. This is fine because:

1. **GitHub Secrets are encrypted** — they are never exposed in logs, PRs, or forks. Only the workflows you write can access them, and they're masked in output.
2. **`.env` files are gitignored** — credentials are never committed to the repo.
3. **The deploy workflow uses SSH** — the VPS credentials (SSH key) are in GitHub Secrets, not in code.
4. **Razorpay live keys, DB passwords, JWT secrets** — all stored in GitHub Environment Secrets, never in source.

**What to NEVER do:**
- Never commit `.env` files (already in `.gitignore`)
- Never hardcode production credentials in source code
- Never paste secrets in PR descriptions or commit messages
- Never use `echo $SECRET` in workflow scripts (GitHub auto-masks, but avoid it)

**If you want extra security:** Make the repo **private** at Settings → General → Danger Zone → Change visibility. GitHub Actions works the same way for private repos.

---

## Step 1: Generate SSH Deploy Key

On your local machine (Windows — don't use `-N ""`, leave passphrase empty when prompted):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f github_deploy_key
```

When asked `Enter passphrase` — press **Enter** twice (empty passphrase).

This creates:
- `github_deploy_key` — private key (goes to GitHub)
- `github_deploy_key.pub` — public key (goes to VPS)

**Status:** [ ] Done

---

## Step 2: Add Public Key to VPS

```bash
ssh root@<YOUR_VPS_IP>

# If deploy user doesn't exist, create it first:
adduser --disabled-password --gecos "Deploy User" deploy
usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

# Add SSH key for deploy user
mkdir -p /home/deploy/.ssh
echo "<paste contents of github_deploy_key.pub>" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Test the connection:
```bash
ssh -i github_deploy_key deploy@<YOUR_VPS_IP> "echo connected"
```

**Status:** [ ] Done

---

## Step 3: Add Repository Secrets in GitHub

Go to: https://github.com/raymond571/StrikersAcademy/settings/secrets/actions

Click **New repository secret** for each:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your Hetzner VPS IPv4 (e.g. `46.62.236.207`) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Entire contents of `github_deploy_key` file (private key, including `-----BEGIN/END-----` lines) |

**Status:** [ ] Done

---

## Step 4: Create "production" GitHub Environment

Go to: https://github.com/raymond571/StrikersAcademy/settings/environments

1. Click **New environment** → name: `production`
2. Set **Deployment branches** → select **Selected branches** → add `master`
3. (Optional) Check **Required reviewers** and add yourself for manual approval
4. Under **Environment secrets**, add each:

| Secret | Value | How to generate |
|--------|-------|-----------------|
| `DATABASE_URL` | `postgresql://strikers_user:YOUR_DB_PASS@127.0.0.1:5432/strikersacademy?schema=public` | Use the password from VPS setup |
| `JWT_SECRET` | 64-char random string | `openssl rand -hex 32` |
| `COOKIE_SECRET` | 64-char random string | `openssl rand -hex 32` |
| `CLIENT_URL` | `https://strickersacademy.in` | |
| `RAZORPAY_KEY_ID` | `rzp_live_XXXXXXXXXXXX` | From Razorpay dashboard (live mode) |
| `RAZORPAY_KEY_SECRET` | Live secret key | From Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Live webhook secret | From Razorpay dashboard > Webhooks |

**Status:** [ ] Done

---

## Step 5: Create "development" GitHub Environment

Same page: https://github.com/raymond571/StrikersAcademy/settings/environments

1. Click **New environment** → name: `development`
2. Set **Deployment branches** → select **Selected branches** → add `develop`
3. Under **Environment secrets**, add each:

| Secret | Value |
|--------|-------|
| `DATABASE_URL` | Same as prod (or separate dev DB if you want) |
| `JWT_SECRET` | Different random: `openssl rand -hex 32` |
| `COOKIE_SECRET` | Different random: `openssl rand -hex 32` |
| `CLIENT_URL` | `https://strickersacademy.in` (or `https://dev.strickersacademy.in`) |
| `RAZORPAY_KEY_ID` | `rzp_test_SYmp8sbHRMYjzE` (test key) |
| `RAZORPAY_KEY_SECRET` | Test secret from Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Test webhook secret |

**Status:** [ ] Done

---

## Step 6: Cloudflare SSL & DNS

### 6a. DNS Records

Cloudflare Dashboard → DNS → Records.

**IMPORTANT:** Delete any old/stale A records (e.g. from GoDaddy). You should have ONLY:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `YOUR_VPS_IPV4` | Proxied (orange cloud) |
| CNAME | `www` | `strickersacademy.in` | Proxied (orange cloud) |

Optionally add IPv6:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| AAAA | `@` | `YOUR_VPS_IPV6` | Proxied (orange cloud) |

### 6b. SSL Mode

Cloudflare → SSL/TLS → Overview:
- Set encryption mode: **Full (Strict)**

### 6c. Origin Certificate

Cloudflare → SSL/TLS → Origin Server → **Create Certificate**:
- Hostnames: `*.strickersacademy.in, strickersacademy.in` (default)
- Validity: 15 years (default)
- Click Create

Then on the VPS:
```bash
# Paste the Origin Certificate
sudo nano /etc/ssl/cloudflare/origin.pem
# (paste certificate, save)

# Paste the Private Key
sudo nano /etc/ssl/cloudflare/origin-key.pem
# (paste key, save)

# Set permissions
sudo chmod 644 /etc/ssl/cloudflare/origin.pem
sudo chmod 600 /etc/ssl/cloudflare/origin-key.pem
```

### 6d. Authenticated Origin Pulls

Cloudflare → SSL/TLS → Origin Server → **Authenticated Origin Pulls → ON**

This is REQUIRED — Nginx is configured to verify Cloudflare's client certificate. Without this toggle, you'll get `400 No required SSL certificate was sent`.

### 6e. Edge Settings

Cloudflare → SSL/TLS → Edge Certificates:
- Always Use HTTPS: **ON**
- Automatic HTTPS Rewrites: **ON**
- Minimum TLS Version: **1.2**

**Status:** [ ] Done

---

## Step 7: First-time VPS Setup

```bash
ssh root@<YOUR_VPS_IP>

# Clone the repo
git clone https://github.com/raymond571/StrikersAcademy.git /var/www/strickersacademy

# Mark as safe directory (needed when running as root on deploy-owned repo)
git config --global --add safe.directory /var/www/strickersacademy

# Run the automated setup
cd /var/www/strickersacademy
bash deployment/setup-vps.sh
```

### After setup-vps.sh completes:

The script handles steps 1-18 automatically. Then do these manual steps:

```bash
# 1. Clean node_modules and reinstall (avoids tar errors)
cd /var/www/strickersacademy
rm -rf node_modules server/node_modules client/node_modules shared/node_modules
npm ci

# 2. Swap Prisma to PostgreSQL and push schema
sed -i 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma
cd server
rm -rf prisma/migrations  # Remove SQLite migrations
npx prisma db push         # Create tables directly
npx prisma generate        # Generate client for PostgreSQL
cd ..

# 3. Seed the database
cd server
export $(grep -v '^#' .env | xargs)
npx tsx prisma/seed.ts
cd ..

# 4. Build everything
npm run build --workspace=shared
npm run build --workspace=server
npm run build --workspace=client

# 5. Start PM2
pm2 delete strikers-api 2>/dev/null
pm2 start deployment/ecosystem.config.js
pm2 save
pm2 startup systemd

# 6. Reload Nginx (after pasting Cloudflare certs in Step 6c)
sudo nginx -t && sudo systemctl reload nginx
```

### Verify:
```bash
curl http://localhost:5000/api/auth/me
# Should return: {"success":false,"error":"Unauthorised — please log in","statusCode":401}
```

Then visit `https://strickersacademy.in` in browser.

**Seed data credentials:**

| Role | Phone | Password |
|------|-------|----------|
| Admin | `9000000001` | `admin123` |
| Staff | `9000000002` | `staff123` |
| Customer | `9876543210` | `test123` |

**Status:** [ ] Done

---

## Step 8: CI/CD — How It Works

### Automatic Deployment

Once Steps 1-7 are complete, CI/CD is automatic:

1. **Push to `master`** → CI runs tests → deploys to **production** environment
2. **Push to `develop`** → CI runs tests → deploys to **development** environment
3. **Pull requests** → CI runs tests only (no deploy)

### Manual Deployment

Go to: https://github.com/raymond571/StrikersAcademy/actions → **Deploy** → **Run workflow** → pick environment → **Run**

### What the Pipeline Does

```
Push to master
    │
    ▼
CI Workflow (.github/workflows/ci.yml)
    ├── npm ci
    ├── Build shared types
    ├── Generate Prisma client
    └── Run server tests (95 tests)
    │
    ▼ (if tests pass)
Deploy Workflow (.github/workflows/deploy.yml)
    ├── SSH into VPS
    ├── git fetch + reset --hard
    ├── Write server/.env from GitHub Secrets
    ├── Write client/.env (VITE_ build vars)
    └── Run deploy.sh --skip-pull
         ├── Swap Prisma provider to postgresql
         ├── npm ci --omit=dev
         ├── prisma generate + migrate deploy
         ├── Build shared → server → client
         ├── PM2 restart
         └── Nginx reload
```

### Testing CI/CD

After setting up GitHub Secrets (Steps 3-5):

```bash
# Make a small change and push
cd /path/to/StrikersAcademy
echo "" >> README.md
git add README.md
git commit -m "test: trigger CI/CD pipeline"
git push origin master
```

Then watch: https://github.com/raymond571/StrikersAcademy/actions

**Status:** [ ] Done

---

## Architecture

```
User Browser
    │
    ▼
Cloudflare (DNS + SSL + CDN + Auth Origin Pull)
    │
    ▼
Nginx (port 443, reverse proxy, serves static files)
    ├── /api/* → proxy to localhost:5000 (Fastify)
    └── /* → serve /client/dist/ (React SPA)
    │
    ▼
PM2 → Fastify (port 5000, localhost only)
    │
    ▼
PostgreSQL (port 5432, localhost only)
```

---

## Troubleshooting

### `npm ci` fails with TAR_ENTRY_ERROR / ENOTEMPTY

Stale `node_modules`. Delete and retry:
```bash
cd /var/www/strickersacademy
rm -rf node_modules server/node_modules client/node_modules shared/node_modules
npm ci
```

### Prisma migration_lock.toml mismatch (sqlite vs postgresql)

When switching from SQLite to PostgreSQL:
```bash
cd /var/www/strickersacademy/server
rm -rf prisma/migrations
npx prisma db push
npx prisma generate
```

### Prisma "Environment variable not found: DATABASE_URL"

When running seed or prisma commands outside PM2:
```bash
cd /var/www/strickersacademy/server
export $(grep -v '^#' .env | xargs)
npx tsx prisma/seed.ts
```

### PM2 "Script not found: dist/index.js"

The TypeScript compiler outputs to `dist/server/src/` (not `dist/`). This is already fixed in `ecosystem.config.js`. If it happens:
```bash
find server/dist/ -name "index.js"
# Then update ecosystem.config.js script path to match
```

### Prisma client not initialized after git reset

`git reset --hard` reverts schema to sqlite. Re-swap and regenerate:
```bash
sed -i 's/provider = "sqlite"/provider = "postgresql"/' server/prisma/schema.prisma
npx prisma generate --schema=server/prisma/schema.prisma
pm2 restart strikers-api
```

### `400 No required SSL certificate was sent`

Cloudflare Authenticated Origin Pulls is not enabled:
- Cloudflare → SSL/TLS → Origin Server → **Authenticated Origin Pulls → ON**

To test locally on VPS (bypassing client cert requirement):
```bash
# This will show the 400 error — that's expected
curl -k https://localhost/
# Use this instead to test the API directly:
curl http://localhost:5000/api/auth/me
```

### DNS pointing to wrong IP / old GoDaddy records

Delete all A records in Cloudflare except your Hetzner VPS IP. Check:
```bash
curl -4 -s ifconfig.me   # Get VPS IPv4
```
Ensure only that IP is in the A record.

### Deploy fails with SSH error
- Verify `VPS_SSH_KEY` contains the full private key (including `-----BEGIN/END-----`)
- Test SSH locally: `ssh -i github_deploy_key deploy@<VPS_IP>`
- Check VPS firewall: `sudo ufw status` (port 22 must be open)

### Deploy fails with "dubious ownership"
```bash
git config --global --add safe.directory /var/www/strickersacademy
```

### TypeScript build errors on VPS but not locally
The VPS may have a different Node/TypeScript version. All `$transaction` callbacks need explicit types:
```typescript
prisma.$transaction(async (tx: TxClient) => { ... })
```
All `.map()`, `.some()`, `.reduce()` callbacks need explicit parameter types when `strict: true`.

### Site shows 502 Bad Gateway
```bash
pm2 status                         # Check if process is running
pm2 logs strikers-api --lines 30   # Check error logs
ss -tlnp | grep 5000              # Check if port is listening
```

### Razorpay payments fail in production
- Ensure `RAZORPAY_KEY_ID` starts with `rzp_live_` (not `rzp_test_`)
- Register webhook URL in Razorpay dashboard: `https://strickersacademy.in/api/payments/webhook`

### Database migration fails
```bash
sudo systemctl status postgresql              # Check PostgreSQL is running
cat /var/www/strickersacademy/server/.env | grep DATABASE  # Check URL
cd /var/www/strickersacademy/server && npx prisma migrate deploy  # Manual migration
```
