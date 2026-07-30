# Phase 8D.3 Web Route Map

Generated from `apps/web/src/app/**/page.tsx` at `9cc3b954b2a3d84897e6865f0ce4ce912e579858` before the Phase 8D.3 commits.

## Public and CUSTOMER routes

| URL                                   | Purpose                                                                     | Authentication                   | Entry / previous and next journey                                                     | Navigation / browser proof                                                            |
| ------------------------------------- | --------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/`                                   | Public booking entry and authoritative availability search                  | Anonymous or CUSTOMER            | Entry: public URL. Next: quote via available room type.                               | Public header booking link; `phase-8d3-public-entry.spec.ts`                          |
| `/booking/search`                     | Existing standalone availability search                                     | Anonymous or CUSTOMER            | Entry: legacy direct URL. Next: `/booking/quote/[quoteId]`.                           | Reuses root availability component; `availability-quote.spec.ts`                      |
| `/booking/quote/[quoteId]`            | Quote, coupon preview and contact HOLD form                                 | Anonymous or CUSTOMER            | Previous: `/` or `/booking/search`; next: in-place HOLD success.                      | Root result CTA; `availability-quote.spec.ts`, `public-booking-vertical-flow.spec.ts` |
| `/booking/manage`                     | Guest booking lookup through email OTP                                      | Guest session after verification | Entry: public header or HOLD success. Next: in-place booking detail/payment controls. | Public header guest-access link; `public-booking-vertical-flow.spec.ts`               |
| `/booking/manage/[bookingCode]/claim` | Link a proved guest booking to CUSTOMER account                             | CUSTOMER plus guest proof        | Previous: guest booking detail. Next: customer bookings.                              | Existing claim route; customer identity coverage                                      |
| `/login`                              | CUSTOMER Google or deterministic local OIDC login; guest lookup alternative | Anonymous                        | Entry: public header. Next: `/account/bookings` after login or `/booking/manage`.     | Public header login link; `customer-identity-browser.spec.ts`                         |
| `/account`                            | CUSTOMER account index                                                      | CUSTOMER                         | Redirects to `/account/bookings`.                                                     | Existing account shell                                                                |
| `/account/profile`                    | CUSTOMER profile                                                            | CUSTOMER                         | Entry: authenticated public header/account shell. Next: account/bookings or root.     | Existing account shell; `customer-identity-browser.spec.ts`                           |
| `/account/bookings`                   | CUSTOMER booking list                                                       | CUSTOMER                         | Entry: login, authenticated public header/account shell. Next: booking detail.        | Existing account shell; `customer-identity-browser.spec.ts`                           |
| `/account/bookings/[bookingCode]`     | CUSTOMER booking detail                                                     | CUSTOMER                         | Previous: booking list. Next: existing payment/booking actions where allowed.         | Booking list; customer identity coverage                                              |

Payment selection and payment status are intentionally embedded in the authenticated guest booking detail shown at `/booking/manage` after a successful HOLD and OTP verification. There is no separate public payment page.

## ADMIN routes

ADMIN navigation remains isolated in the ADMIN shell and is not exposed from public booking cards or the public header.

| URL                                     | Purpose                        | Authentication        | Entry / next journey | Browser proof                               |
| --------------------------------------- | ------------------------------ | --------------------- | -------------------- | ------------------------------------------- |
| `/admin/login`                          | ADMIN login                    | Anonymous             | Entry to ADMIN shell | `admin-auth.spec.ts`                        |
| `/admin`                                | ADMIN workspace                | ADMIN                 | ADMIN shell index    | ADMIN browser suite                         |
| `/admin/forbidden`                      | Forbidden state                | ADMIN or denied actor | Guard destination    | `admin-auth.spec.ts`                        |
| `/admin/property`                       | Property settings              | ADMIN                 | ADMIN shell          | `admin-property.spec.ts`                    |
| `/admin/price-tiers`                    | Price-tier operations          | ADMIN                 | ADMIN shell          | `admin-price-tier.spec.ts`                  |
| `/admin/room-types`                     | Room-type operations           | ADMIN                 | ADMIN shell          | `admin-room-type.spec.ts`                   |
| `/admin/amenities`                      | Amenity operations             | ADMIN                 | ADMIN shell          | `admin-amenity.spec.ts`                     |
| `/admin/rooms`                          | Room list                      | ADMIN                 | ADMIN shell          | `admin-room.spec.ts`                        |
| `/admin/rooms/new`                      | Create physical room           | ADMIN                 | From rooms list      | `admin-room.spec.ts`                        |
| `/admin/rooms/[id]`                     | Room detail                    | ADMIN                 | From rooms list      | `admin-room.spec.ts`                        |
| `/admin/maintenance`                    | Maintenance blocks             | ADMIN                 | ADMIN shell          | `admin-maintenance.spec.ts`                 |
| `/admin/rate-plans`                     | Rate-plan operations           | ADMIN                 | ADMIN shell          | `admin-rate-plan.spec.ts`                   |
| `/admin/coupons`                        | Coupon list                    | ADMIN                 | ADMIN shell          | `admin-coupon.spec.ts`                      |
| `/admin/coupons/new`                    | Create coupon                  | ADMIN                 | From coupon list     | `admin-coupon.spec.ts`                      |
| `/admin/coupons/[couponId]`             | Coupon detail                  | ADMIN                 | From coupon list     | `admin-coupon.spec.ts`                      |
| `/admin/bookings`                       | Booking operations list        | ADMIN                 | ADMIN shell          | `phase-7g-admin-booking-operations.spec.ts` |
| `/admin/bookings/[bookingCode]`         | Booking operations detail      | ADMIN                 | From booking list    | `phase-7g-admin-booking-operations.spec.ts` |
| `/admin/operational-reviews`            | Operational review list        | ADMIN                 | ADMIN shell          | ADMIN review coverage                       |
| `/admin/operational-reviews/[reviewId]` | Operational review detail      | ADMIN                 | From review list     | ADMIN review coverage                       |
| `/admin/payment-providers`              | Payment-provider configuration | ADMIN                 | ADMIN shell          | `payment-provider-operations.spec.ts`       |
| `/admin/payments`                       | Payment reconciliation list    | ADMIN                 | ADMIN shell          | `payment-gate-b11-b12.spec.ts`              |
| `/admin/payments/[paymentId]`           | Payment reconciliation detail  | ADMIN                 | From payment list    | `payment-gate-b11-b12.spec.ts`              |

## Non-page Web routes

- `/health`: Web health endpoint. Not a product entry point.
- `/locale`: locale cookie update route. Used by the header locale control.
