# Shared Types Reference — StrikersAcademy
_Maintained by Shakespeare. Source: `shared/src/types/`, `shared/src/index.ts`_
_Last updated: 2026-04-02_

Package name: `@strikers/shared`
Import: `import type { ... } from '@strikers/shared'`
All types are re-exported from `shared/src/index.ts`.

---

## User types (`shared/src/types/user.ts`)

```ts
type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  role: UserRole;
  createdAt: string; // ISO date string (serialised for transport)
}

interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  age: number;
  password: string;
}

interface LoginPayload {
  phone: string;
  password: string;
}

interface AuthResponse {
  user: User;
  message: string; // JWT in httpOnly cookie — field is informational only
}
```

---

## Facility types (`shared/src/types/facility.ts`)

```ts
type FacilityType = 'NET' | 'TURF';

interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  description: string;
  pricePerSlot: number; // paise (₹1 = 100 paise)
  isActive: boolean;
}

interface CreateFacilityPayload {
  name: string;
  type: FacilityType;
  description: string;
  pricePerSlot: number;
}

interface UpdateFacilityPayload extends Partial<CreateFacilityPayload> {
  isActive?: boolean;
}
```

---

## Slot types (`shared/src/types/slot.ts`)

```ts
interface Slot {
  id: string;
  facilityId: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM (24h)
  endTime: string;     // HH:MM (24h)
  capacity: number;    // max concurrent bookings
  bookedCount: number; // current confirmed/pending bookings
  isAvailable: boolean; // derived: capacity - bookedCount > 0
  priceOverride: number | null; // paise; null = use facility.pricePerSlot
  facility?: Facility;
}

interface CreateSlotPayload {
  facilityId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  priceOverride?: number;
}

interface BulkCreateSlotsPayload {
  facilityId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  timeSlots: Array<{ startTime: string; endTime: string }>;
  capacity?: number;
}

interface SlotQueryParams {
  facilityId?: string;
  date?: string;
  availableOnly?: boolean;
}
```

---

## Booking types (`shared/src/types/booking.ts`)

```ts
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED' | 'REFUNDED';
type BookingFor = 'SELF' | 'CHILD' | 'TEAM';
type PaymentMethod = 'ONLINE' | 'OFFLINE';

interface Booking {
  id: string;
  userId: string;
  slotId: string;
  status: BookingStatus;
  bookingFor: BookingFor;
  playerName: string | null;  // child name when bookingFor=CHILD
  teamName: string | null;    // team name when bookingFor=TEAM
  paymentMethod: PaymentMethod;
  couponId: string | null;
  discountPaise: number | null;
  notes: string | null;
  createdById: string | null; // staff/admin who created it
  createdAt: string;
  updatedAt: string;
  slot?: Slot;       // populated when requested
  payment?: Payment; // populated when requested
}

interface CreateBookingPayload {
  slotId: string;
  bookingFor?: BookingFor;    // default: SELF
  playerName?: string;
  teamName?: string;
  paymentMethod?: PaymentMethod; // default: ONLINE
  couponCode?: string;
  notes?: string;
}

interface AdminCreateBookingPayload extends CreateBookingPayload {
  userId: string; // admin must specify the user
}

interface UpdateBookingStatusPayload {
  status: BookingStatus;
  notes?: string;
}
```

---

## Payment types (`shared/src/types/payment.ts`)

```ts
type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

interface Payment {
  id: string;
  bookingId: string;
  amount: number;           // paise, after discount
  method: string;           // 'ONLINE' | 'OFFLINE'
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

// Returned by POST /api/payments/initiate — used to open Razorpay checkout
interface InitiatePaymentResponse {
  razorpayOrderId: string;
  amount: number;   // paise
  currency: string; // 'INR'
  keyId: string;    // Razorpay public key
  bookingId: string;
}

// Sent from client after Razorpay checkout success
interface VerifyPaymentPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  bookingId: string;
}
```

---

## Coupon types (`shared/src/types/coupon.ts`)

```ts
type DiscountType = 'FIXED' | 'PERCENT';

interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number; // paise for FIXED; basis points for PERCENT (100 = 1%)
  maxUsage: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
}

interface CreateCouponPayload {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxUsage?: number;
  validFrom: string;
  validUntil?: string;
}

// Returned by POST /api/bookings/validate-coupon (planned)
interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  discountPaise?: number;
  error?: string;
}
```

---

## API envelope types (`shared/src/types/api.ts`)

```ts
interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

interface ApiError {
  success: false;
  error: string;
  statusCode: number;
  details?: unknown;
}

interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```
