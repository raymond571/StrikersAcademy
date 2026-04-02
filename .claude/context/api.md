# API Reference — StrikersAcademy
_Maintained by Shakespeare. Source: `server/src/routes/`, `server/src/controllers/`_
_Last updated: 2026-04-02_

## Conventions
- Base URL: `http://localhost:3000` (dev) / production domain
- All routes prefixed with `/api`
- Auth: httpOnly cookie named `token` (JWT, 30-day expiry)
- Response envelope: `{ success: true, data: T, message?: string }` on success
- Error envelope: `{ success: false, error: string, statusCode: number, details?: unknown }`
- Money: all amounts in **paise** (₹1 = 100 paise)

## Status legend
- DONE — fully implemented and working
- STUB — route exists, returns 501
- TODO — not yet defined in routes

---

## Auth — `/api/auth`
Registered in `app.ts` with prefix `/api/auth`.

| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| POST | `/api/auth/register` | None | DONE | Body: `{ name, email, phone, age, password }`. Sets httpOnly JWT cookie. Returns `{ user }`. |
| POST | `/api/auth/login` | None | DONE | Body: `{ phone, password }`. Sets httpOnly JWT cookie. Returns `{ user }`. |
| POST | `/api/auth/logout` | Required | DONE | Clears `token` cookie. Returns `{ success: true }`. |
| GET | `/api/auth/me` | Required | DONE | Returns current user profile (no password). `{ user }`. |

### Register validation (Zod, AuthController)
- `name`: min 2, max 100 chars
- `email`: valid email, max 255
- `phone`: regex `/^[6-9]\d{9}$/` (10-digit Indian mobile)
- `age`: integer 5–120
- `password`: min 6, max 128

### JWT payload
```json
{ "id": "cuid", "phone": "9876543210", "role": "CUSTOMER" }
```

---

## Facilities — `/api/facilities`

| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| GET | `/api/facilities` | None | DONE | Returns `{ facilities }` — all active, sorted by name |
| GET | `/api/facilities/:id` | None | DONE | Returns `{ facility }` — 404 if not found |
| GET | `/api/facilities/:id/slots` | None | DONE | Query: `?date=YYYY-MM-DD&availableOnly=true`. Returns `{ slots }` with `bookedCount`, `isAvailable`, `isBlocked`, `effectivePrice`. Checks AvailabilityBlocks. |
| POST | `/api/facilities` | ADMIN | DONE | Body: `{ name, type, description?, pricePerSlot }`. Zod validated. Returns 201. |
| PATCH | `/api/facilities/:id` | ADMIN | DONE | Body: `{ name?, type?, description?, pricePerSlot?, isActive? }`. Zod validated. |

---

## Bookings — `/api/bookings`

| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| POST | `/api/bookings` | Required | DONE | Body: `{ slotId, bookingFor?, playerName?, teamName?, paymentMethod?, notes? }`. Transactional capacity check + duplicate prevention. Creates payment record. Offline auto-confirms. Returns 201. |
| GET | `/api/bookings` | Required | DONE | Query: `?page=1&limit=10`. Returns paginated bookings with slot + facility + payment. |
| GET | `/api/bookings/:id` | Required | DONE | Returns `{ booking }` with relations. Ownership check (user, admin, or staff). |
| PATCH | `/api/bookings/:id/cancel` | Required | DONE | Cancels booking. 2-hour cutoff for customers; admin/staff can cancel anytime. Marks paid online payments as REFUNDED. |

---

## Payments — `/api/payments`

| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| POST | `/api/payments/initiate` | Required | STUB | Body: `{ bookingId }`. Creates Razorpay order. Returns `InitiatePaymentResponse`. |
| POST | `/api/payments/verify` | Required | STUB | Body: `{ razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId }`. Verifies HMAC. |
| POST | `/api/payments/webhook` | None | STUB | Razorpay webhook (verified via `X-Razorpay-Signature` header). |

---

## Admin — `/api/admin`
All routes require `authenticate`. Role notes per route.

| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| GET | `/api/admin/dashboard` | ADMIN or STAFF | STUB | Summary stats: bookings, revenue, facilities |
| GET | `/api/admin/bookings` | ADMIN or STAFF | STUB | Query: `?status=&date=&facilityId=&page=&limit=` |
| POST | `/api/admin/bookings` | ADMIN or STAFF | STUB | Manual booking for any user |
| PATCH | `/api/admin/bookings/:id/status` | ADMIN or STAFF | STUB | Approve / reject / refund |
| GET | `/api/admin/users` | ADMIN or STAFF | STUB | List all registered users |
| POST | `/api/admin/slots/bulk` | ADMIN only | STUB | Body: `{ facilityId, startDate, endDate, timeSlots, capacity? }` |
| POST | `/api/admin/slots/block` | ADMIN or STAFF | STUB | Body: `{ facilityId?, date, startTime?, endTime?, reason }` |
| DELETE | `/api/admin/slots/block/:id` | ADMIN or STAFF | STUB | Remove availability block |
| GET | `/api/admin/reports/revenue` | ADMIN only | STUB | Query: `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| GET | `/api/admin/coupons` | ADMIN only | STUB | List all coupons |
| POST | `/api/admin/coupons` | ADMIN only | STUB | Create coupon |
| PATCH | `/api/admin/coupons/:id` | ADMIN only | STUB | Update/deactivate coupon |

---

## Utility
| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| GET | `/health` | None | DONE | Returns `{ status, service, https, timestamp }` |

---

## Middleware

### `authenticate` (`server/src/middleware/authenticate.ts`)
- Verifies JWT from `token` cookie via `request.jwtVerify()`
- Returns `401` if missing or invalid
- Attaches decoded payload to `request.user`

### `requireRole(...roles)` / `requireAdmin` / `requireStaffOrAdmin`
- Must run after `authenticate` in `preHandler` chain
- Returns `403` if user role not in allowed list
- `requireAdmin` = `requireRole('ADMIN')`
- `requireStaffOrAdmin` = `requireRole('ADMIN', 'STAFF')`

### `errorHandler` (`server/src/middleware/errorHandler.ts`)
- Handles Fastify validation errors → 400
- Known operational errors (statusCode < 500) → pass-through
- Unknown server errors → 500, no detail leak in production
