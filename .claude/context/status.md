# Implementation Status — StrikersAcademy
_Maintained by Shakespeare. Reflects actual code state, not plans._
_Last updated: 2026-04-02_

## Overall phase
**Phase 4 complete. Admin panel fully implemented — all 12 endpoints live, 6-tab frontend wired with live data.**

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
- [x] Admin page (6-tab panel: Dashboard, Bookings, Users, Slots, Revenue, Coupons)
- [x] `useBookings()` hook
- [x] `services/api.ts` — all API client methods defined (authApi, facilityApi, bookingApi, paymentApi, adminApi)
- [x] Login/Register redirect: already-logged-in users redirect by role (ADMIN→/admin, others→/dashboard)
- [x] `useAuth().login()` returns User object for role-based redirect

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

### Payment API (COMPLETE)
- [x] `PaymentService` — Razorpay SDK wrapper: `createOrder`, `verifySignature`, `verifyWebhookSignature`
- [x] `PaymentController` — fully implemented: initiate, verify, webhook
- [x] `POST /api/payments/initiate` — creates Razorpay order for PENDING booking, idempotent
- [x] `POST /api/payments/verify` — HMAC verification, transactional booking confirmation
- [x] `POST /api/payments/webhook` — handles `payment.captured` + `payment.failed`, idempotent
- [x] Payment page UI — opens Razorpay modal, handles success/failure states
- [x] `errorHandler` updated: 502 pass-through for gateway errors

---

### Admin API (COMPLETE — Phase 4)
- [x] `AdminService` — dashboard, listBookings, createManualBooking, updateBookingStatus, listUsers, bulkCreateSlots, blockSlots, removeBlock, revenueReport, listCoupons, createCoupon, updateCoupon
- [x] `AdminController` — Zod validation for all 12 endpoints
- [x] All 12 admin routes wired to AdminController (no stubs)
- [x] Admin frontend: 6 tab components in `components/admin/`
- [x] `adminApi` added to `services/api.ts` — all 12 admin methods + local types

---

## What is NOT started

### Business logic (controllers + services)
- [ ] Waitlist promotion logic (when booking cancels → promote waitlist)
- [ ] Coupon validation logic
- [ ] Pricing rule resolution logic

### Database
- [ ] Seed file (`prisma/seed.ts` referenced in package.json but not created)
- [ ] Initial migration run

### Frontend
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
