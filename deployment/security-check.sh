#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# StrikersAcademy Security Audit Script
# Usage: ./security-check.sh [local|prod]
#   local — skip infrastructure checks (for dev machines)
#   prod  — run all checks (default)
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

MODE="${1:-prod}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0
TOTAL=0

pass() {
  TOTAL=$((TOTAL + 1))
  PASS=$((PASS + 1))
  local severity="${2:-MEDIUM}"
  echo -e "  ${GREEN}PASS${NC} [$severity] $1"
}

fail() {
  TOTAL=$((TOTAL + 1))
  FAIL=$((FAIL + 1))
  local severity="${2:-MEDIUM}"
  echo -e "  ${RED}FAIL${NC} [$severity] $1"
}

warn() {
  TOTAL=$((TOTAL + 1))
  WARN=$((WARN + 1))
  local severity="${2:-LOW}"
  echo -e "  ${YELLOW}WARN${NC} [$severity] $1"
}

skip() {
  echo -e "  ${CYAN}SKIP${NC} $1 (local mode)"
}

header() {
  echo ""
  echo -e "${BOLD}── $1 ──${NC}"
}

# ═════════════════════════════════════════════════════════════════
header "WEB SECURITY"
# ═════════════════════════════════════════════════════════════════

# Rate limiting
if grep -q '@fastify/rate-limit' "$SERVER_DIR/package.json" 2>/dev/null && \
   grep -rq 'rate-limit\|rateLimit\|rate_limit' "$SERVER_DIR/src/app.ts" 2>/dev/null; then
  pass "Rate limiting: @fastify/rate-limit installed and registered" "HIGH"
else
  fail "Rate limiting: @fastify/rate-limit not found" "HIGH"
fi

# Helmet / security headers
if grep -q '@fastify/helmet' "$SERVER_DIR/package.json" 2>/dev/null && \
   grep -rq 'helmet\|Helmet' "$SERVER_DIR/src/app.ts" 2>/dev/null; then
  pass "Security headers: @fastify/helmet installed and registered" "HIGH"
else
  fail "Security headers: @fastify/helmet not found" "HIGH"
fi

# CORS — CLIENT_URL
if [ -f "$SERVER_DIR/.env" ]; then
  CLIENT_URL=$(grep '^CLIENT_URL=' "$SERVER_DIR/.env" 2>/dev/null | cut -d= -f2-)
  if [ -n "$CLIENT_URL" ] && [ "$CLIENT_URL" != "http://localhost:5173" ]; then
    pass "CORS: CLIENT_URL is set to $CLIENT_URL" "MEDIUM"
  elif [ "$MODE" = "prod" ]; then
    fail "CORS: CLIENT_URL is default localhost or unset" "MEDIUM"
  else
    warn "CORS: CLIENT_URL is default localhost (OK for dev)" "LOW"
  fi
else
  if [ "$MODE" = "prod" ]; then
    fail "CORS: server/.env not found" "MEDIUM"
  else
    warn "CORS: server/.env not found (OK for dev)" "LOW"
  fi
fi

# JWT secret
if [ -f "$SERVER_DIR/.env" ]; then
  JWT_SECRET=$(grep '^JWT_SECRET=' "$SERVER_DIR/.env" 2>/dev/null | cut -d= -f2-)
  if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "fallback-jwt-secret-change-in-prod" ]; then
    pass "JWT secret: custom value is set" "CRITICAL"
  else
    fail "JWT secret: using default/missing value" "CRITICAL"
  fi
else
  fail "JWT secret: server/.env not found" "CRITICAL"
fi

# Cookie secret
if [ -f "$SERVER_DIR/.env" ]; then
  COOKIE_SECRET=$(grep '^COOKIE_SECRET=' "$SERVER_DIR/.env" 2>/dev/null | cut -d= -f2-)
  if [ -n "$COOKIE_SECRET" ] && [ "$COOKIE_SECRET" != "fallback-secret-change-in-prod" ]; then
    pass "Cookie secret: custom value is set" "CRITICAL"
  else
    fail "Cookie secret: using default/missing value" "CRITICAL"
  fi
else
  fail "Cookie secret: server/.env not found" "CRITICAL"
fi

# HTTPS / SSL certs
if [ "$MODE" = "prod" ]; then
  if [ -d "/etc/ssl/cloudflare" ] && [ -f "/etc/ssl/cloudflare/origin-cert.pem" ]; then
    pass "HTTPS: SSL certs found at /etc/ssl/cloudflare/" "HIGH"
  else
    fail "HTTPS: SSL certs not found at /etc/ssl/cloudflare/" "HIGH"
  fi
else
  skip "HTTPS: SSL cert check"
fi

# Trust proxy
if grep -q 'trustProxy' "$SERVER_DIR/src/app.ts" 2>/dev/null; then
  pass "Trust proxy: trustProxy is configured" "MEDIUM"
else
  fail "Trust proxy: trustProxy not set in Fastify config" "MEDIUM"
fi

# ═════════════════════════════════════════════════════════════════
header "DATABASE"
# ═════════════════════════════════════════════════════════════════

# PostgreSQL check
if [ -f "$SERVER_DIR/.env" ]; then
  DB_URL=$(grep '^DATABASE_URL=' "$SERVER_DIR/.env" 2>/dev/null | cut -d= -f2-)
  if echo "$DB_URL" | grep -q 'postgresql://'; then
    pass "PostgreSQL: DATABASE_URL uses postgresql://" "HIGH"

    # Check for default superuser
    if echo "$DB_URL" | grep -q 'postgresql://postgres:'; then
      warn "DB user: using default 'postgres' superuser — consider a dedicated user" "MEDIUM"
    else
      pass "DB user: not using default 'postgres' superuser" "MEDIUM"
    fi
  elif [ "$MODE" = "prod" ]; then
    fail "PostgreSQL: DATABASE_URL does not use postgresql://" "HIGH"
  else
    warn "PostgreSQL: DATABASE_URL is not postgresql:// (OK for dev)" "LOW"
  fi
else
  fail "PostgreSQL: server/.env not found" "HIGH"
fi

# DB connection test
if command -v npx &>/dev/null && [ -f "$SERVER_DIR/prisma/schema.prisma" ]; then
  if cd "$SERVER_DIR" && npx prisma db execute --stdin <<< "SELECT 1" &>/dev/null; then
    pass "DB connection: successfully connected" "HIGH"
  else
    fail "DB connection: could not connect to database" "HIGH"
  fi
else
  warn "DB connection: cannot test (prisma or schema not found)" "MEDIUM"
fi

# Prisma migrations
if [ -d "$SERVER_DIR/prisma/migrations" ]; then
  pass "Migrations: prisma/migrations directory exists" "MEDIUM"
else
  warn "Migrations: no migrations directory found" "MEDIUM"
fi

# Backups (prod only)
if [ "$MODE" = "prod" ]; then
  if crontab -l 2>/dev/null | grep -q 'pg_dump'; then
    pass "Backups: pg_dump cron job found" "HIGH"
  else
    fail "Backups: no pg_dump cron job found" "HIGH"
  fi
else
  skip "Backups: pg_dump cron job check"
fi

# ═════════════════════════════════════════════════════════════════
header "AUTHENTICATION"
# ═════════════════════════════════════════════════════════════════

# Password hashing algorithm
if grep -rq 'argon2\|bcrypt\|scrypt' "$SERVER_DIR/src/" 2>/dev/null; then
  ALGO=$(grep -roh 'argon2\|bcrypt\|scrypt' "$SERVER_DIR/src/" 2>/dev/null | head -1)
  pass "Password hashing: using $ALGO" "HIGH"
else
  warn "Password hashing: could not detect algorithm (argon2/bcrypt/scrypt)" "HIGH"
fi

# JWT expiry
JWT_EXPIRY=$(grep -roh "expiresIn: '[^']*'" "$SERVER_DIR/src/controllers/auth.controller.ts" 2>/dev/null | head -1)
if [ -n "$JWT_EXPIRY" ]; then
  if echo "$JWT_EXPIRY" | grep -qE "'(30d|90d|365d)'"; then
    fail "JWT expiry: $JWT_EXPIRY is too long — use 7d or less" "MEDIUM"
  else
    pass "JWT expiry: $JWT_EXPIRY" "MEDIUM"
  fi
else
  warn "JWT expiry: could not detect expiresIn value" "MEDIUM"
fi

# Rate limit on login
if grep -rq 'rateLimit' "$SERVER_DIR/src/routes/auth.ts" 2>/dev/null; then
  pass "Rate limit on login: per-route rate limit configured" "HIGH"
else
  fail "Rate limit on login: no per-route rate limit on auth routes" "HIGH"
fi

# ═════════════════════════════════════════════════════════════════
header "INFRASTRUCTURE"
# ═════════════════════════════════════════════════════════════════

if [ "$MODE" = "prod" ]; then
  # UFW firewall
  if command -v ufw &>/dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1)
    if echo "$UFW_STATUS" | grep -q 'active'; then
      pass "Firewall: UFW is active" "HIGH"
    else
      fail "Firewall: UFW is not active" "HIGH"
    fi
  else
    warn "Firewall: ufw not found" "HIGH"
  fi

  # Nginx config test
  if command -v nginx &>/dev/null; then
    if sudo nginx -t &>/dev/null; then
      pass "Nginx: config test passed" "MEDIUM"
    else
      fail "Nginx: config test failed" "MEDIUM"
    fi
  else
    warn "Nginx: not installed" "MEDIUM"
  fi

  # PM2
  if command -v pm2 &>/dev/null; then
    if pm2 list 2>/dev/null | grep -q 'online'; then
      pass "PM2: app is running" "HIGH"
    else
      fail "PM2: no app running" "HIGH"
    fi
  else
    warn "PM2: not installed" "MEDIUM"
  fi
else
  skip "Firewall: UFW status check"
  skip "Nginx: config test"
  skip "PM2: process check"
fi

# Node version
NODE_VER=$(node -v 2>/dev/null | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -ge 20 ]; then
  pass "Node version: $NODE_VER (>= 20)" "MEDIUM"
else
  warn "Node version: $NODE_VER (recommended >= 20)" "MEDIUM"
fi

# npm audit
if [ -f "$SERVER_DIR/package-lock.json" ]; then
  AUDIT_OUTPUT=$(cd "$SERVER_DIR" && npm audit --json 2>/dev/null || true)
  CRITICAL=$(echo "$AUDIT_OUTPUT" | grep -o '"critical":[0-9]*' | cut -d: -f2 || echo "0")
  HIGH=$(echo "$AUDIT_OUTPUT" | grep -o '"high":[0-9]*' | cut -d: -f2 || echo "0")
  if [ "${CRITICAL:-0}" -gt 0 ] || [ "${HIGH:-0}" -gt 0 ]; then
    fail "npm audit: ${CRITICAL:-0} critical, ${HIGH:-0} high vulnerabilities" "HIGH"
  else
    pass "npm audit: no critical/high vulnerabilities" "MEDIUM"
  fi
else
  warn "npm audit: no package-lock.json found" "LOW"
fi

# ═════════════════════════════════════════════════════════════════
header "FILE SECURITY"
# ═════════════════════════════════════════════════════════════════

# .env permissions
if [ -f "$SERVER_DIR/.env" ]; then
  if [ "$MODE" = "prod" ]; then
    ENV_PERMS=$(stat -c '%a' "$SERVER_DIR/.env" 2>/dev/null || stat -f '%Lp' "$SERVER_DIR/.env" 2>/dev/null)
    if [ "$ENV_PERMS" = "600" ]; then
      pass ".env permissions: $ENV_PERMS" "MEDIUM"
    else
      fail ".env permissions: $ENV_PERMS (should be 600)" "MEDIUM"
    fi
  else
    pass ".env permissions: skipped in local mode" "LOW"
  fi
else
  warn ".env file not found" "MEDIUM"
fi

# .env not in git
if cd "$PROJECT_ROOT" && git ls-files --error-unmatch server/.env &>/dev/null 2>&1; then
  fail ".env in git: server/.env is tracked — run 'git rm --cached server/.env'" "CRITICAL"
else
  pass ".env in git: server/.env is not tracked" "CRITICAL"
fi

# .gitignore has .env
if grep -q '\.env' "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
  pass ".gitignore: .env patterns present" "MEDIUM"
else
  fail ".gitignore: no .env pattern found" "MEDIUM"
fi

# SSL key permissions (prod only)
if [ "$MODE" = "prod" ]; then
  if [ -f "/etc/ssl/cloudflare/origin-key.pem" ]; then
    KEY_PERMS=$(stat -c '%a' /etc/ssl/cloudflare/origin-key.pem 2>/dev/null || stat -f '%Lp' /etc/ssl/cloudflare/origin-key.pem 2>/dev/null)
    if [ "$KEY_PERMS" = "600" ]; then
      pass "SSL key permissions: $KEY_PERMS" "HIGH"
    else
      fail "SSL key permissions: $KEY_PERMS (should be 600)" "HIGH"
    fi
  else
    warn "SSL key: /etc/ssl/cloudflare/origin-key.pem not found" "HIGH"
  fi
else
  skip "SSL key permissions check"
fi

# ═════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Security Audit Summary ($MODE mode)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASS${NC}: $PASS"
echo -e "  ${RED}FAIL${NC}: $FAIL"
echo -e "  ${YELLOW}WARN${NC}: $WARN"
echo -e "  ${BOLD}Score: $PASS/$TOTAL checks passed${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}Action required: $FAIL check(s) failed.${NC}"
  exit 1
else
  echo -e "  ${GREEN}All checks passed or are warnings only.${NC}"
  exit 0
fi
