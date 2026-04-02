# Implementation Status — StrikersAcademy
_Maintained by Shakespeare. Reflects actual code state, not plans._
_Last updated: 2026-04-02_

## Overall phase
**Phase 2 — in progress. Foundation + Facility & Booking APIs complete. Payments, Admin, and frontend integration remain.**

---

## What is DONE

### Infrastructure
- [x] Monorepo setup (npm workspaces: client, server, shared)
- [x] TypeScript configured in all three packages
- [x] Shared types package (`@strikers/shared`) with all domain types
- [x] Fastify server with plugin architecture (`app.ts`)
- [x] Prisma schema — all models defined (User, Facility, Slot, Booking, WaitlistEntry, Payment, Coupon, PricingRule, AvailabilityBlock, ContentBlock, GalleryImage)
- [x] SQLite database (dev), PostgreSQL-ready (swap provider)
- [x] CORS, cookie, JWT plugins registered
- [x] HTTPS/SSL support via env vars (`SSL_KEY_PATH`, `SSL_CERT_PATH`)
- [x] Health check endpoint (`GET /health`)
- [x] Error handler middleware
- [x] `.env.example` with all variables documented

### Auth (COMPLETE)
- [x] `POST /api/auth/register` — full implementation with Zod validation
- [x] `POST /api/auth/login` — phone + password, sets httpOnly JWT cookie
- [x] `POST /api/auth/logout` — clears cookie
- [x] `GET /api/auth/me` — returns current user profile
- [x] `authenticate` middleware (JWT cookie verification)
- [x] `requireRole` / `requireAdmin` / `requireStaffOrAdmin` guards
- [x] Password hashing with Node scrypt (no external dep)
- [x] Phone enumeration protection (same error for wrong phone + wrong password)

### Frontend shell (COMPLETE)
- [x] React Router v6 routing with all routes defined
- [x] `AuthProvider` + `useAuth()` hook (login, logout, register, session restore)
- [x] `ProtectedRoute` and `AdminRoute` layout guards
- [x] `Layout` + `Navbar` components
- [x] Landing page (static content)
- [x] Login page (functional — calls live auth API)
- [x] Register page (functional — calls live auth API)
- [x] Dashboard page (shell — UI ready, depends on booking API)
- [x] Booking page (shell — UI flow complete, depends on facility/booking API)
- [x] Payment page (Razorpay integration wired, depends on payment API)
- [x] Admin page (placeholder only)
- [x] `useBookings()` hook
- [x] `services/api.ts` — all API client methods defined (authApi, facilityApi, bookingApi, paymentApi)

### Facility API (COMPLETE)
- [x] `FacilityService` — listActive, getById, getSlots (capacity-based availability + AvailabilityBlock checking), create, update
- [x] `FacilityController` — Zod validation for all endpoints
- [x] All 5 facility routes wired and working

### Booking API (COMPLETE)
- [x] `BookingService` — transactional createBooking (capacity check + duplicate prevention), listByUser (paginated), getById (ownership check), cancelBooking (2h cutoff for customers)
- [x] `BookingController` — Zod validation for create + list query params
- [x] All 4 booking routes wired and working
- [x] Offline bookings auto-confirm; online start as PENDING
- [x] Payment records created for both online and offline bookings
- [x] Cancelled paid-online bookings marked as REFUNDED

### Payments infrastructure (PARTIAL)
- [x] `PaymentService` — Razorpay SDK wrapper with `createOrder`, `verifySignature`, `verifyWebhookSignature`
- [x] Payment page UI — opens Razorpay modal, handles success/failure states

---

## What is STUB (route exists, returns 501)

### Payment API
- [ ] `POST /api/payments/initiate` — create Razorpay order
- [ ] `POST /api/payments/verify` — verify payment signature + confirm booking
- [ ] `POST /api/payments/webhook` — Razorpay webhook handler

### Admin API (all 12 endpoints are stubs)
- [ ] `GET /api/admin/dashboard`
- [ ] `GET /api/admin/bookings` (with filters)
- [ ] `POST /api/admin/bookings` (manual booking)
- [ ] `PATCH /api/admin/bookings/:id/status`
- [ ] `GET /api/admin/users`
- [ ] `POST /api/admin/slots/bulk`
- [ ] `POST /api/admin/slots/block`
- [ ] `DELETE /api/admin/slots/block/:id`
- [ ] `GET /api/admin/reports/revenue`
- [ ] `GET /api/admin/coupons`
- [ ] `POST /api/admin/coupons`
- [ ] `PATCH /api/admin/coupons/:id`

---

## What is NOT started

### Business logic (controllers + services)
- [ ] `PaymentController` — all methods are `throw new Error('Not implemented')`
- [ ] `AdminController` — not created
- [ ] Waitlist promotion logic (when booking cancels → promote waitlist)
- [ ] Coupon validation logic
- [ ] Pricing rule resolution logic

### Database
- [ ] Seed file (`prisma/seed.ts` referenced in package.json but not created)
- [ ] Initial migration run

### Frontend
- [ ] Admin panel — all functional sections (booking management, facility CRUD, slot creation, user list)
- [ ] Landing page dynamic content (from `ContentBlock` model)
- [ ] Gallery page / section
- [ ] Coupon code input on booking flow
- [ ] Waitlist join flow
- [ ] Offline payment option in booking flow
- [ ] Booking for child/team UI

### Infrastructure
- [ ] Content management API (ContentBlock, GalleryImage endpoints)
- [ ] Coupon validation endpoint (`POST /api/bookings/validate-coupon` referenced in shared types but not in routes)

---

## Known gaps / issues
1. JWT expiry: `.env.example` says `JWT_EXPIRES_IN=7d` but the controllers hardcode `'30d'` — these should be reconciled.
3. `VITE_RAZORPAY_KEY_ID` env var is defined but not yet used in `Payment.tsx` — the page currently expects the key to come from `InitiatePaymentResponse.keyId` (which is the right pattern, but the env var is unused).
4. `AdminRoute` only checks `role === 'ADMIN'` — STAFF cannot access `/admin` route even though many admin API endpoints allow STAFF. A separate `/staff` route or STAFF access to `/admin` may be needed.
5. No seed data — first run requires manual admin user creation via API or direct DB.
