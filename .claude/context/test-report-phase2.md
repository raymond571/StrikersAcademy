# Test Report — Phase 1 + Phase 2
_Tested: 2026-04-02 | Server: http://localhost:3000 | Method: curl_

## Summary
- **6 API tests executed, all passed**
- **Seed data verified**: 3 users, 4 facilities, 308 slots
- **Server health**: OK
- **Client dev server**: Running on port 5173

---

## Test Results

### Auth

| # | Endpoint | Method | Result | Details |
|---|----------|--------|--------|---------|
| 1 | `/api/auth/login` | POST | PASS (200) | Phone: 9876543210, password: test123. Returned user object (id, name "Arul", role "CUSTOMER"). JWT httpOnly cookie set. |

### Facilities

| # | Endpoint | Method | Result | Details |
|---|----------|--------|--------|---------|
| 2 | `/api/facilities` | GET | PASS (200) | Returned 4 facilities: Net Lane 1, Net Lane 2 (NET, 50000 paise), Turf Pitch A (TURF, 150000 paise), Turf Pitch B (TURF, 120000 paise). All isActive:true. |
| 3 | `/api/facilities/:id/slots` | GET | PASS (200) | Queried facility-net-1 for 2026-04-03. Returned 11 slots (06:00–21:00). All: bookedCount:0, isAvailable:true, isBlocked:false, effectivePrice:50000. |

### Bookings

| # | Endpoint | Method | Result | Details |
|---|----------|--------|--------|---------|
| 4 | `/api/bookings` | POST | PASS (201) | Created booking for slot 06:00 on Net Lane 1. paymentMethod:"OFFLINE" → status auto-set to "CONFIRMED". effectivePrice:50000. Payment record created. |
| 5 | `/api/bookings` | GET | PASS (200) | Returned paginated list (page:1, limit:10, total:1). Booking includes slot + facility + payment relations. |
| 6 | `/api/bookings` (duplicate) | POST | PASS (409) | Same slot re-booked → "This slot is fully booked". Capacity check + duplicate prevention working. |

### Health

| # | Endpoint | Method | Result | Details |
|---|----------|--------|--------|---------|
| — | `/health` | GET | PASS (200) | `{"status":"ok","service":"StrikersAcademy API","timestamp":"2026-04-02T19:16:16.772Z"}` |

---

## Seed Data

| Entity | Count | Details |
|--------|-------|---------|
| Users | 3 | Admin (9000000001/admin123), Staff (9000000002/staff123), Customer Arul (9876543210/test123) |
| Facilities | 4 | 2 NETs (Rs 500/slot), 2 TURFs (Rs 1500 + Rs 1200/slot) |
| Slots | 308 | 11 time slots x 4 facilities x 7 days (Apr 2–8). NET capacity=1, TURF capacity=2 |

---

## Not Tested (deferred)

- [ ] Online payment flow (Razorpay integration) — Phase 3
- [ ] Booking cancellation endpoint — exists but not curl-tested
- [ ] Admin endpoints — all still 501 stubs
- [ ] Frontend UI in browser — API-only testing this round
- [ ] Booking for CHILD/TEAM variants
- [ ] AvailabilityBlock filtering — no blocks in seed data to test against
- [ ] Staff/Admin role-specific access paths
