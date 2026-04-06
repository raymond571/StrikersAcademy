# StrikersAcademy — CI/CD & Infrastructure Setup Guide

Complete step-by-step guide to connect GitHub Actions, Hetzner VPS, and Cloudflare.

---

## Prerequisites

- [x] Hetzner VPS IP address
- [x] Cloudflare DNS configured for `strickersacademy.in`
- [x] GitHub repo: `raymond571/StrikersAcademy`

---

## Step 1: Generate SSH Deploy Key

On your local machine:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f github_deploy_key -N ""
```

This creates:
- `github_deploy_key` — private key (goes to GitHub)
- `github_deploy_key.pub` — public key (goes to VPS)

**Status:** [ ] Done

---

## Step 2: Add Public Key to VPS

```bash
ssh root@<YOUR_VPS_IP>

# Add key for deploy user
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
| `VPS_HOST` | Your Hetzner VPS IP (e.g. `5.78.xxx.xxx`) |
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

Cloudflare Dashboard → DNS → Records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `YOUR_VPS_IP` | Proxied (orange cloud) |
| A | `www` | `YOUR_VPS_IP` | Proxied (orange cloud) |

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

### 6d. Edge Settings

Cloudflare → SSL/TLS → Edge Certificates:
- Always Use HTTPS: **ON**
- Automatic HTTPS Rewrites: **ON**
- Minimum TLS Version: **1.2**

**Status:** [ ] Done

---

## Step 7: First-time VPS Setup

If you haven't run the full VPS setup yet:

```bash
ssh root@<YOUR_VPS_IP>

# Clone the repo
git clone https://github.com/raymond571/StrikersAcademy.git /var/www/strickersacademy

# Run the automated setup (installs Node, PostgreSQL, Nginx, PM2, backup cron, etc.)
cd /var/www/strickersacademy
bash deployment/setup-vps.sh
```

After setup completes:
- Note down the **DB password** it shows (or the one you entered)
- Paste Cloudflare origin certs (Step 6c above)
- Then reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Status:** [ ] Done

---

## Step 8: Test the Pipeline

### Test CI:
Push any change to `master` — check the **Actions** tab on GitHub. The CI workflow should run tests.

### Test Deploy:
After CI passes, the Deploy workflow triggers automatically:
- Go to: https://github.com/raymond571/StrikersAcademy/actions
- Watch the "Deploy" workflow
- It will SSH into VPS, write `.env`, build, and restart PM2

### Manual Deploy:
- Go to Actions → Deploy → **Run workflow** → select environment → click **Run**

### Verify on VPS:
```bash
ssh deploy@<YOUR_VPS_IP>
pm2 logs strikers-api --lines 20
curl http://localhost:5000/api/auth/me
```

### Verify in browser:
- Open https://strickersacademy.in
- Should see the StrikersAcademy landing page

**Status:** [ ] Done

---

## How It Works

```
Developer pushes to master
        |
        v
GitHub Actions CI (runs tests)
        |
        v (if tests pass)
GitHub Actions Deploy
        |
        v
SSH into Hetzner VPS
        |
        v
1. git pull latest code
2. Write .env from GitHub Secrets
3. Swap Prisma to PostgreSQL
4. npm ci → build shared → build server → build client
5. Run Prisma migrations
6. Restart PM2
7. Reload Nginx
        |
        v
Cloudflare (SSL/CDN) → Nginx (reverse proxy) → PM2/Fastify (:5000) → PostgreSQL
        |
        v
User sees https://strickersacademy.in
```

---

## Branch Strategy

| Branch | Environment | Trigger | Razorpay |
|--------|-------------|---------|----------|
| `master` | production | Auto on push | Live keys |
| `develop` | development | Auto on push | Test keys |
| Any branch | — | CI only (no deploy) | — |

---

## Troubleshooting

### Deploy fails with SSH error
- Verify `VPS_SSH_KEY` contains the full private key (including `-----BEGIN/END-----`)
- Test SSH locally: `ssh -i github_deploy_key deploy@<VPS_IP>`
- Check VPS firewall: `sudo ufw status` (port 22 must be open)

### Deploy fails with permission error
- The `deploy` user needs sudo access: `sudo cat /etc/sudoers.d/deploy`
- The `.env` file permissions: `ls -la /var/www/strickersacademy/server/.env`

### Site shows 502 Bad Gateway
- Check PM2: `pm2 status` and `pm2 logs strikers-api`
- Check if port 5000 is listening: `ss -tlnp | grep 5000`
- Check Nginx config: `sudo nginx -t`

### Razorpay payments fail in production
- Ensure `RAZORPAY_KEY_ID` starts with `rzp_live_` (not `rzp_test_`)
- Ensure webhook URL is registered in Razorpay dashboard: `https://strickersacademy.in/api/payments/webhook`

### Database migration fails
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Check DATABASE_URL in `.env`: `cat /var/www/strickersacademy/server/.env | grep DATABASE`
- Try manual migration: `cd /var/www/strickersacademy/server && npx prisma migrate deploy`
