# StrikersAcademy — Production Deployment Guide

Domain: **strickersacademy.in**
Stack: Fastify (Node.js) + React + PostgreSQL
Hosting: Hetzner VPS + Cloudflare (SSL termination)

---

## 1. Hetzner VPS Initial Setup

### 1.1 Create the server

- Hetzner Cloud → Create Server → **Ubuntu 22.04** (CX21 or higher)
- Note the public IPv4 address (e.g., `5.78.x.x`)

### 1.2 First-time SSH login

```bash
ssh root@YOUR_VPS_IP

# Create a deploy user
adduser deploy
usermod -aG sudo deploy

# Disable root SSH login
sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### 1.3 Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Cloudflare → origin)
ufw allow 443/tcp   # HTTPS (Cloudflare → origin)
ufw enable
ufw status
```

Only ports **22**, **80**, and **443** should be open.

### 1.4 System updates

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential
```

---

## 2. Cloudflare DNS Setup

### 2.1 Add the domain

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Add Site → `strickersacademy.in`
2. Select the **Free** plan.

### 2.2 DNS records

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `YOUR_VPS_IP` | Proxied (orange cloud) |
| A | `www` | `YOUR_VPS_IP` | Proxied (orange cloud) |

### 2.3 Update nameservers

Update your domain registrar's nameservers to the ones Cloudflare provides (e.g., `ada.ns.cloudflare.com`, `lee.ns.cloudflare.com`).

---

## 3. Cloudflare Origin Certificate

This certificate encrypts traffic between Cloudflare and your VPS.

### 3.1 Generate the certificate

1. Cloudflare Dashboard → SSL/TLS → Origin Server → **Create Certificate**
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

### 3.3 Authenticated Origin Pulls (optional but recommended)

Download the Cloudflare Origin Pull CA certificate:

```bash
sudo curl -o /etc/ssl/cloudflare/cloudflare-origin-pull-ca.pem \
  https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
```

Then enable in Cloudflare Dashboard → SSL/TLS → Origin Server → **Authenticated Origin Pulls → On**.

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

### 4.3 Create log directory

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

### 6.2 Configure environment

```bash
cp deployment/.env.production.example server/.env
nano server/.env
# Fill in: DATABASE_URL, JWT_SECRET, COOKIE_SECRET, RAZORPAY keys
```

### 6.3 First deployment

```bash
bash deployment/deploy.sh
```

### 6.4 Verify

```bash
# Check PM2
pm2 status
pm2 logs strikers-api --lines 20

# Check API health
curl http://127.0.0.1:5000/health

# Check Nginx
sudo nginx -t
curl -I https://strickersacademy.in/health
```

---

## 7. Cloudflare Settings

Configure these in the Cloudflare Dashboard:

### SSL/TLS

| Setting | Value |
|---------|-------|
| SSL/TLS encryption mode | **Full (strict)** |
| Always Use HTTPS | **On** |
| Minimum TLS Version | **1.2** |
| TLS 1.3 | **On** |
| Automatic HTTPS Rewrites | **On** |

### Security → HSTS

| Setting | Value |
|---------|-------|
| Enable HSTS | **On** |
| Max-Age | **6 months** (or 12) |
| Include subdomains | **On** |
| Preload | **On** |
| No-Sniff | **On** |

### Speed → Optimization

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

```bash
# Add to crontab: daily backup at 2 AM
0 2 * * * pg_dump -U strikers_user strikersacademy | gzip > /var/backups/strikersacademy-$(date +\%Y\%m\%d).sql.gz
```
