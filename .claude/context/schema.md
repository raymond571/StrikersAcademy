# Database Schema — StrikersAcademy
_Maintained by Shakespeare. Source of truth: `server/prisma/schema.prisma`_
_Last updated: 2026-04-02_

## Engine
- Provider: SQLite (dev) / PostgreSQL (prod, swap `provider` in schema)
- ORM: Prisma 5.x
- Note: SQLite has no native enums — all enum-like fields are `String` with runtime validation

## Monetary convention
All monetary values stored in **paise** (1 INR = 100 paise). e.g. ₹500 = `50000`.

---

## Models

### User (`users`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | mandatory |
| email | String | unique, mandatory |
| phone | String | unique, primary login identifier |
| age | Int | mandatory (5–120) |
| password | String | scrypt hashed (`salt:derivedKey`) |
| role | String | default `"CUSTOMER"` |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

Role values: `"ADMIN"` | `"STAFF"` | `"CUSTOMER"`

Relations:
- `bookings` → Booking[] (as user)
- `waitlistEntries` → WaitlistEntry[]
- `manualBookings` → Booking[] via `"ManualBookingCreator"` relation

---

### Facility (`facilities`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "Net Lane 1", "Turf Pitch A" |
| type | String | `"NET"` or `"TURF"` |
| description | String | default `""` |
| pricePerSlot | Int | paise |
| isActive | Boolean | default `true` |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

Relations:
- `slots` → Slot[]
- `availabilityBlocks` → AvailabilityBlock[]

---

### Slot (`slots`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| facilityId | String | FK → Facility (Cascade delete) |
| date | String | ISO date `YYYY-MM-DD` |
| startTime | String | 24h `HH:MM` |
| endTime | String | 24h `HH:MM` |
| capacity | Int | default `1`, max concurrent bookings |
| priceOverride | Int? | paise, overrides facility.pricePerSlot |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

Unique constraint: `[facilityId, date, startTime]`
Indexes: `date`, `[facilityId, date]`

Relations:
- `facility` → Facility
- `bookings` → Booking[]
- `waitlist` → WaitlistEntry[]

---

### Booking (`bookings`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| userId | String | FK → User (Restrict delete) |
| slotId | String | FK → Slot (Restrict delete) |
| status | String | default `"PENDING"` |
| bookingFor | String | default `"SELF"` |
| playerName | String? | child's name when bookingFor=CHILD |
| teamName | String? | team name when bookingFor=TEAM |
| paymentMethod | String | default `"ONLINE"` |
| createdById | String? | staff/admin who created this (manual) |
| couponId | String? | FK → Coupon |
| discountPaise | Int? | actual discount applied |
| notes | String? | internal admin notes |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

Status values: `"PENDING"` | `"CONFIRMED"` | `"CANCELLED"` | `"WAITLISTED"` | `"REFUNDED"`
bookingFor values: `"SELF"` | `"CHILD"` | `"TEAM"`
paymentMethod values: `"ONLINE"` | `"OFFLINE"`

Indexes: `userId`, `slotId`, `status`, `createdAt`

Relations:
- `user` → User
- `slot` → Slot
- `createdBy` → User? (via `"ManualBookingCreator"`)
- `coupon` → Coupon?
- `payment` → Payment? (one-to-one)

---

### WaitlistEntry (`waitlist_entries`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| slotId | String | FK → Slot (Cascade delete) |
| userId | String | FK → User (Cascade delete) |
| position | Int | 1-indexed queue position |
| createdAt | DateTime | auto |

Unique: `[slotId, userId]`, `[slotId, position]`
Index: `slotId`

---

### Payment (`payments`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| bookingId | String | unique, FK → Booking (Cascade delete) |
| amount | Int | paise, final after discount |
| currency | String | default `"INR"` |
| method | String | `"ONLINE"` or `"OFFLINE"` |
| razorpayOrderId | String? | unique, null for offline |
| razorpayPaymentId | String? | set after success |
| razorpaySignature | String? | stored for audit |
| status | String | default `"PENDING"` |
| paidAt | DateTime? | |
| refundedAt | DateTime? | |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

Status values: `"PENDING"` | `"SUCCESS"` | `"FAILED"` | `"REFUNDED"`
Index: `razorpayOrderId`

---

### Coupon (`coupons`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| code | String | unique |
| description | String | default `""` |
| discountType | String | `"FIXED"` or `"PERCENT"` |
| discountValue | Int | paise for FIXED; basis points for PERCENT (100 = 1%) |
| maxUsage | Int? | null = unlimited |
| usedCount | Int | default `0` |
| validFrom | DateTime | |
| validUntil | DateTime? | null = no expiry |
| isActive | Boolean | default `true` |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

---

### PricingRule (`pricing_rules`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | |
| facilityType | String? | `"NET"` | `"TURF"` | null (all types) |
| dayOfWeek | Int? | 0=Sun … 6=Sat, null=all days |
| startTime | String? | `HH:MM`, null=all day |
| endTime | String? | `HH:MM` |
| priceOverride | Int | paise — price when rule matches |
| priority | Int | default `0`, higher wins |
| isActive | Boolean | default `true` |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

---

### AvailabilityBlock (`availability_blocks`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| facilityId | String? | null = blocks all facilities |
| date | String | `YYYY-MM-DD` |
| startTime | String? | `HH:MM`, null = all day |
| endTime | String? | `HH:MM` |
| reason | String | default `"Blocked"` (e.g. "Rain", "Holiday", "Maintenance") |
| createdById | String | User.id of creator |
| createdAt | DateTime | auto |

Indexes: `date`, `[facilityId, date]`

---

### ContentBlock (`content_blocks`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| key | String | unique, e.g. `"hero_title"`, `"about_text"`, `"contact_phone"` |
| value | String | |
| updatedAt | DateTime | auto |

---

### GalleryImage (`gallery_images`)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| url | String | |
| caption | String | default `""` |
| sortOrder | Int | default `0` |
| isActive | Boolean | default `true` |
| createdAt | DateTime | auto |
