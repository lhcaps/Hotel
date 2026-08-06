# Route and feature inventory

Evidence date: 2026-08-06, Asia/Bangkok

## Inventory counts

| Inventory                                  | Count | Evidence                                       |
| ------------------------------------------ | ----: | ---------------------------------------------- |
| Runtime API routes                         |   105 | pnpm check:endpoints                           |
| Documented API routes                      |   101 | pnpm check:endpoints                           |
| Explicitly allowlisted undocumented routes |     4 | GET/POST /api/auth/* and the two health routes |
| Unexpected undocumented routes             |     0 | pnpm check:endpoints                           |
| Missing documented runtime routes          |     0 | pnpm check:endpoints                           |
| Web route pages                            |    36 | Current Next build route output                |

The complete generated endpoint inventory remains at docs/audit/phase-8d/endpoint-inventory.csv. This final inventory is grouped by business surface so the route-to-feature boundary is readable without duplicating generated rows.

## Public and customer surfaces

| Surface                           | Web routes                                                                                                | API boundary                                                                          | State                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Public landing and catalog        | /, /rooms, /rooms/[roomTypeId], /locale, /health                                                          | GET /api/v1/public/room-types                                                         | Implemented; production read-only check passed                                                             |
| Availability search               | /booking/search and landing search                                                                        | POST /api/v1/availability/search, POST /api/v1/public/availability/nearby             | Implemented; production response contained no physical-room or operational fields                          |
| Server-computed offers and quotes | /booking/quote/[quoteId]                                                                                  | POST /api/v1/quotes/offers, POST /api/v1/quotes, GET /api/v1/quotes/{id}              | Implemented in source and local tests; production quote issuance was not performed to avoid creating state |
| Guest HOLD and manage             | /booking/manage, /booking/manage/[bookingCode]                                                            | POST /api/v1/public/quotes/{quoteId}/bookings and guest verification/manage endpoints | Implemented in source/local E2E; production mutation not safe for this audit                               |
| Customer account                  | /account, /account/bookings, /account/bookings/[bookingCode], /account/profile, /account/settings, /login | /api/v1/customer/* and auth/session routes                                            | Local evidence available; live Google customer login is BLOCKED_EXTERNAL                                   |

## Administrative surfaces

| Surface                  | Web routes                                                                             | API route families                                                  | Required authority                                                          |
| ------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Admin shell and identity | /admin, /admin/login, /admin/profile, /admin/forbidden                                 | /api/v1/admin/me, /api/auth/*                                       | Server-derived admin session                                                |
| Booking operations       | /admin/bookings, /admin/bookings/[bookingCode], /admin/scanner                         | /api/v1/admin/bookings* and lifecycle routes                        | booking lifecycle permissions                                               |
| Room operations          | /admin/room-operations                                                                 | /api/v1/admin/room-operations                                       | room_operations.read/manage                                                 |
| Room catalog             | /admin/rooms, /admin/rooms/new, /admin/rooms/[id], /admin/room-types, /admin/amenities | /api/v1/admin/rooms*, /room-types*, /amenities*                     | catalog read/manage permissions                                             |
| Maintenance and property | /admin/maintenance, /admin/property, /admin/price-tiers                                | /api/v1/admin/maintenance-blocks*, /property, /price-tiers*         | catalog maintenance/property/price-tier permissions                         |
| Pricing and coupons      | /admin/rate-plans, /admin/coupons, /admin/coupons/new, /admin/coupons/[couponId]       | /api/v1/admin/rate-plans*, /coupons*                                | pricing and coupon permissions                                              |
| Payments and providers   | /admin/payments, /admin/payments/[paymentId], /admin/payment-providers                 | /api/v1/admin/payments*, /payment-providers* and provider callbacks | reconciliation/provider permissions; external provider gates remain blocked |
| Reviews and audit        | /admin/operational-reviews, /admin/operational-reviews/[reviewId], /admin/audit        | /api/v1/admin/operational-reviews*, /audit*                         | review/audit permissions                                                    |
| Admin accounts           | /admin/accounts, /admin/customer-accounts, /admin/departments                          | /api/v1/admin/accounts*, /customer-accounts*, /departments*         | admin account/customer/departments permissions                              |

## Platform and external surfaces

| Surface              | Routes                                             | State                                                                          |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Health and readiness | /health, /api/v1/health/live, /api/v1/health/ready | PASS locally and in production                                                 |
| Auth framework       | /api/auth/*                                        | Runtime allowlist; session cookies remain server-side                          |
| OAuth                | Google provider flow                               | Source/config ready; live external acceptance BLOCKED_EXTERNAL                 |
| Payments             | MoMo and VNPAY simulator/callback families         | Local simulator tests exist; sandbox/real provider acceptance BLOCKED_EXTERNAL |
| SMTP                 | Mailpit/local mail path                            | Local Mailpit ready; live recipient gate BLOCKED_EXTERNAL                      |

## Known inventory gaps

The web room detail route currently obtains a public room-type projection from the catalog list rather than a dedicated public room-type detail API. This is a documented architectural limitation, not a newly introduced production regression. Operations V3 routes/design were not started by this audit.
