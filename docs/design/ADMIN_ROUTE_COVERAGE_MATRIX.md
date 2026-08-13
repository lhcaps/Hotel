# PeaceNest Admin Route Coverage Matrix

Canonical visual contract: **PeaceNest / Hotel Operations**. Every protected route uses the shared sidebar, topbar, breadcrumb context, page header, compact controls, semantic status language, and responsive table/form primitives from `apps/web/src/components/admin/admin-ui.tsx`.

| Route                                   | Page family       | Primary surface                                   | Permission boundary           |
| --------------------------------------- | ----------------- | ------------------------------------------------- | ----------------------------- |
| `/admin`                                | Overview          | KPI strip, focal report chart, operational queues | `report.read`                 |
| `/admin/room-operations`                | Operational table | Room state board + compact filters                | `room.read`                   |
| `/admin/housekeeping`                   | Operational table | Housekeeping workboard + detail sheet             | `housekeeping.read`           |
| `/admin/rooms`                          | Management table  | Physical room inventory                           | `room.read`                   |
| `/admin/rooms/new`                      | Form/create       | Room creation form                                | `room.write`                  |
| `/admin/rooms/[id]`                     | Detail/timeline   | Room detail surface                               | `room.read`                   |
| `/admin/maintenance`                    | Operational table | Maintenance queue                                 | `maintenance.read`            |
| `/admin/room-types`                     | Management table  | Room type catalog                                 | `catalog.room_type.read`      |
| `/admin/amenities`                      | Management table  | Amenity catalog                                   | `catalog.amenity.read`        |
| `/admin/bookings`                       | Operational table | Booking queue + date/status filters               | `booking.read`                |
| `/admin/bookings/[bookingCode]`         | Detail/timeline   | Booking facts, actions, history                   | `booking.read`                |
| `/admin/payments`                       | Operational table | Payment queue + review states                     | `payment.read`                |
| `/admin/payments/[paymentId]`           | Audit/detail      | Reconciliation, attempts, audit trail             | `payment.read`                |
| `/admin/scanner`                        | Operational tool  | Check-in/out scanner and camera                   | `booking.access.write`        |
| `/admin/operational-reviews`            | Audit table       | Review queue + detail sheet                       | `review.read`                 |
| `/admin/operational-reviews/[reviewId]` | Audit/detail      | Review timeline and resolution form               | `review.read`                 |
| `/admin/property`                       | Configuration     | Property policy editor                            | `property.read/write`         |
| `/admin/price-tiers`                    | Configuration     | Rate tier management                              | `pricing.read/write`          |
| `/admin/rate-plans`                     | Configuration     | Rate plan management                              | `pricing.read/write`          |
| `/admin/pricing-policies`               | Configuration     | Policy list + detail sheet                        | `pricing.read/write`          |
| `/admin/coupons`                        | Management table  | Coupon inventory                                  | `coupon.read`                 |
| `/admin/coupons/new`                    | Form/create       | Coupon creation form                              | `coupon.write`                |
| `/admin/coupons/[couponId]`             | Detail/timeline   | Coupon detail + lifecycle action                  | `coupon.read/write`           |
| `/admin/payment-providers`              | Configuration     | Provider settings                                 | `payment_provider.read/write` |
| `/admin/accounts`                       | Management table  | Administrator accounts                            | `admin_account.read/write`    |
| `/admin/customer-accounts`              | Management table  | Customer account directory                        | `customer_account.read`       |
| `/admin/departments`                    | Management table  | Department management                             | `department.read/write`       |
| `/admin/profile`                        | Configuration     | Current administrator profile                     | authenticated session         |
| `/admin/audit`                          | Audit table       | Immutable audit log                               | `audit.read`                  |

## Coverage gates

- Navigation labels are canonical and locale-aware; route and permission semantics remain server-authoritative.
- Tables declare one of `operational`, `management`, or `audit` variants.
- Destructive or confirmation-required actions use `AdminDetailSheet`; browser-native prompt APIs are not used by ADMIN surfaces.
- The accepted visual direction is represented by the PeaceNest shell tokens in `globals.css`; legacy public booking surfaces remain outside the ADMIN scope.
