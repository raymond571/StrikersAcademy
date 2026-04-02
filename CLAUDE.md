# StrikersAcademy - Project Instructions

## PRD Reference
The Product Requirements Document is at: `C:\Users\ARUL RAYMONDS\workspace\claude\.claude\StrickersAcademy-PRD.txt`
All implementation must align with this PRD. When in doubt, refer to the PRD.

## Key PRD Requirements (Phase 1 MVP)

### Auth
- Phone + password login (phone is the login identifier)
- Registration requires: name (mandatory), email (mandatory), phone (mandatory), age (mandatory), password
- Email collected for future account recovery (OTP — future iteration)
- Role-based access: ADMIN, STAFF, CUSTOMER
- Staff role = secondary admin (receptionist)

### Booking System
- Time-slot-based booking with **capacity per slot** (not boolean available/unavailable)
- Prevent double booking via DB constraints + transactions
- Waitlist support
- Auto/manual approval toggle (admin setting)
- Booking for: self, child, or team
- Offline booking support (admin can mark as "pay at venue")
- Admin can create manual bookings

### Pricing
- Admin-defined, editable anytime
- Supports different slot types (net vs turf, peak vs off-peak)

### Payments
- Online: UPI via Razorpay
- Offline: booking without payment, marked for pay-at-venue
- Admin refund handling

### Admin Panel
- Calendar view (day/week)
- Booking list with filters
- Manual booking entry
- Slot blocking (rain/holiday/maintenance)
- Coupon/discount support
- Revenue reporting (daily, weekly)

### Content Management
- Editable landing page sections
- Image gallery (~50 images)
- External video embedding

### Data Model Entities
- Users (with roles)
- Slots (with capacity, not boolean)
- Bookings (with status workflow + booking-for details)
- Payments (online + offline)
- Coupons
- Pricing Rules
- Availability Blocks (for rain/holiday blocking)

## Tech Stack
- Frontend: React (Vite) + TypeScript + TailwindCSS (mobile-first)
- Backend: Fastify + TypeScript
- Database: SQLite (dev) / PostgreSQL (prod) via Prisma
- Payments: Razorpay (UPI)
- Monorepo: client/ server/ shared/

## Constraints
- Budget <= 1000 INR/month infra
- Single academy, single VPS
- Max ~200 daily users, ~10 concurrent
- Mobile-first design (users + admin on phone/tablet)

## HTTPS
- App is HTTPS-ready in production
- Fastify supports native HTTPS via SSL_KEY_PATH + SSL_CERT_PATH env vars
- Recommended production setup: Cloudflare Full SSL termination (Cloudflare → HTTPS → origin)
- Cookies set with `secure: true` in production (NODE_ENV=production)
- If using reverse proxy (Caddy/Nginx), leave SSL env vars blank — proxy handles TLS

## Architecture Notes
- httpOnly cookie JWT auth (secure flag in production)
- Prisma ORM with workspace references
- Shared types in shared/ package
- API prefix: /api
- Vite proxy in dev: /api -> http://localhost:3000

## Shakespeare Context Files
Agents should read these files in `.claude/context/` BEFORE searching source code:
- `schema.md` — Database models, fields, relationships
- `api.md` — All API endpoints with implementation status
- `frontend.md` — Pages, components, hooks, services
- `types.md` — Shared TypeScript types
- `stack.md` — Tech stack, project structure, env vars
- `status.md` — What's done vs TODO

These files are maintained by Shakespeare and reflect the current codebase state.
When making code changes, Shakespeare must be invoked to update these files.
