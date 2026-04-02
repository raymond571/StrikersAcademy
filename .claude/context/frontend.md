# Frontend Reference — StrikersAcademy
_Maintained by Shakespeare. Source: `client/src/`_
_Last updated: 2026-04-02_

## Tech stack
- React 18 + TypeScript (Vite)
- React Router v6
- TailwindCSS (mobile-first, custom brand colors)
- Axios for API calls (with httpOnly cookie credential support)
- Razorpay loaded via CDN script tag (not npm)

## Entry point
- `client/src/main.tsx` — mounts `<App />` with `<BrowserRouter>`
- `client/src/App.tsx` — defines all routes, wraps in `<AuthProvider>`

---

## Routes
| Path | Component | Protection | Status |
|---|---|---|---|
| `/` | LandingPage | Public | DONE |
| `/login` | LoginPage | Public | DONE |
| `/register` | RegisterPage | Public | DONE |
| `/dashboard` | DashboardPage | Auth required | DONE (functional shell, needs real API) |
| `/booking` | BookingPage | Auth required | DONE (functional shell, needs real API) |
| `/payment/:bookingId` | PaymentPage | Auth required | DONE (Razorpay integration wired) |
| `/admin` | AdminPage | ADMIN role only | PLACEHOLDER |
| `/admin/*` | AdminPage | ADMIN role only | PLACEHOLDER |
| `*` | Redirect → `/` | — | DONE |

---

## Pages

### `Landing.tsx` — `/`
**Status: Complete (static content)**
- Hero section with CTA buttons (Book a Slot → `/register`, Sign In → `/login`)
- Features grid: Net Lanes, Turf Wickets, Easy Booking
- Wrapped in `<Layout>` (includes Navbar)
- Content is static strings — not yet fetching from `ContentBlock` model

---

### `Login.tsx` — `/login`
**Status: Complete**
- Form: phone (tel, pattern `[6-9][0-9]{9}`), password
- On submit: calls `useAuth().login(phone, password)` → navigates to `/dashboard`
- Error display inline
- Link to `/register`

---

### `Register.tsx` — `/register`
**Status: Complete**
- Form: name, email, phone, age (number, 5–120), password (min 6)
- On submit: calls `useAuth().register(data)` → navigates to `/dashboard`
- Error display inline
- Link to `/login`

---

### `Dashboard.tsx` — `/dashboard`
**Status: Functional shell (depends on Booking API — currently 501)**
- Shows welcome message with `user.name`
- Stats grid: Total Bookings, Confirmed, Pending (from `useBookings()`)
- Booking list: shows facility name, date, time, status badge
- Link to `/booking`
- Falls back gracefully if API returns error

---

### `Booking.tsx` — `/booking`
**Status: Functional shell (depends on Facility + Booking API — currently 501)**
- 3-step flow:
  1. Select facility (cards with name, type, price/slot)
  2. Pick date (date picker, min = today)
  3. Choose time slot (grid, disabled if `!slot.isAvailable`)
- On confirm: calls `bookingApi.create(slotId)` → navigates to `/payment/:bookingId`

---

### `Payment.tsx` — `/payment/:bookingId`
**Status: Functional shell (depends on Payment API — currently 501)**
- Loads booking + creates Razorpay order on mount
- Opens Razorpay checkout modal (`window.Razorpay`)
- On success: calls `paymentApi.verify(...)` → navigates to `/dashboard` after 2s
- States: `loading` | `ready` | `processing` | `success` | `error`
- Razorpay theme color: `#f97316` (brand orange)

---

### `Admin.tsx` — `/admin`
**Status: Placeholder**
- Static stat cards (Total Bookings, Revenue, Active Facilities, Users — all showing `—`)
- Placeholder sections: Facilities, Slot Management, Recent Bookings
- No data fetching yet

---

## Components

### `Layout` (`components/layout/Layout.tsx`)
| Prop | Type | Notes |
|---|---|---|
| children | React.ReactNode | Page content |

- Renders `<Navbar />` + `<main>` with max-width container
- All pages use this wrapper

---

### `Navbar` (`components/layout/Navbar.tsx`)
- Uses `useAuth()` for user state
- Unauthenticated: Login + Register buttons
- Authenticated: Dashboard link, Book a Slot link, Admin link (if `user.role === 'ADMIN'`), Logout button
- Logo: "Strikers" (brand-600) + "Academy" (pitch-600)

---

### `ProtectedRoute` (`components/layout/ProtectedRoute.tsx`)
- Wraps routes requiring any authenticated user
- Shows loading spinner while `isLoading === true`
- Redirects to `/login` if `user === null`
- Renders `<Outlet />` if authenticated

---

### `AdminRoute` (`components/layout/AdminRoute.tsx`)
- Extends ProtectedRoute behavior — also checks `user.role === 'ADMIN'`
- Redirects to `/dashboard` if authenticated but not ADMIN
- Renders `<Outlet />` if ADMIN

---

## Hooks

### `useAuth()` (`hooks/useAuth.tsx`)
**Provider: `AuthProvider` — must wrap all consuming components (placed at root in App.tsx)**

| Return value | Type | Notes |
|---|---|---|
| user | `User \| null` | Current authenticated user |
| isLoading | boolean | True while checking session on mount |
| login | `(phone, password) => Promise<void>` | Calls `authApi.login`, updates state |
| logout | `() => Promise<void>` | Calls `authApi.logout`, clears state |
| register | `(data) => Promise<void>` | Calls `authApi.register`, updates state |

- On mount, calls `authApi.me()` to restore session from cookie

---

### `useBookings()` (`hooks/useBookings.ts`)
| Return value | Type | Notes |
|---|---|---|
| bookings | `Booking[]` | User's bookings |
| isLoading | boolean | |
| error | `string \| null` | |
| refetch | `() => Promise<void>` | Manually re-fetch |

- Calls `bookingApi.listMine()` on mount

---

## Services — `services/api.ts`
Single axios instance, `baseURL = VITE_API_URL ?? 'http://localhost:3000'`, `withCredentials: true`.
Response interceptor unwraps error messages from `error.response.data.error`.

### `authApi`
| Method | Signature | Endpoint |
|---|---|---|
| register | `(data) => Promise<AuthResponse>` | POST `/api/auth/register` |
| login | `(phone, password) => Promise<AuthResponse>` | POST `/api/auth/login` |
| logout | `() => Promise<void>` | POST `/api/auth/logout` |
| me | `() => Promise<User>` | GET `/api/auth/me` |

### `facilityApi`
| Method | Signature | Endpoint |
|---|---|---|
| list | `() => Promise<Facility[]>` | GET `/api/facilities` |
| getById | `(id) => Promise<Facility>` | GET `/api/facilities/:id` |
| getSlots | `(facilityId, date, availableOnly?) => Promise<Slot[]>` | GET `/api/facilities/:id/slots` |

### `bookingApi`
| Method | Signature | Endpoint |
|---|---|---|
| create | `(slotId) => Promise<Booking>` | POST `/api/bookings` |
| listMine | `() => Promise<Booking[]>` | GET `/api/bookings` |
| getById | `(id) => Promise<Booking>` | GET `/api/bookings/:id` |
| cancel | `(id) => Promise<Booking>` | PATCH `/api/bookings/:id/cancel` |

### `paymentApi`
| Method | Signature | Endpoint |
|---|---|---|
| initiate | `(bookingId) => Promise<InitiatePaymentResponse>` | POST `/api/payments/initiate` |
| verify | `(payload: VerifyPaymentPayload) => Promise<void>` | POST `/api/payments/verify` |

---

## Custom Tailwind classes (used throughout)
- `btn-primary` — primary orange button
- `btn-secondary` — secondary outlined button
- `card` — white rounded shadow card
- `input` — styled text input
- `label` — form label
- `brand-*` — orange brand colors
- `pitch-*` — green pitch/cricket colors
