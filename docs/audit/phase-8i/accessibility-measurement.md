# Phase 8I accessibility measurement

Fresh command: `pnpm --filter @room/web exec vitest run test/phase8i-critical-surfaces.a11y.test.tsx test/customer-bookings.a11y.test.tsx` passed 8 tests. Existing focused axe tests passed 40 tests on the related product surfaces. `jest-axe` runs at simulated widths of 390 and 1366 pixels where noted; responsive overflow and keyboard interaction are browser-tested separately.

| #   | Critical surface           | Axe evidence                                                         | Viewports                         |
| --- | -------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| 1   | Public home/search         | `public-homepage.test.tsx`                                           | semantic; browser 390/1366        |
| 2   | Availability results       | `public-homepage.test.tsx` search result flow                        | semantic; browser 390/1366        |
| 3   | Quote/recommendation       | `quote-contact-form.test.tsx`, `public-pricing.a11y.test.tsx`        | semantic; browser desktop         |
| 4   | Contact/HOLD               | `quote-contact-form.test.tsx`, `hold-success-panel.test.tsx`         | semantic                          |
| 5   | Guest booking access       | `booking-detail-panel.test.tsx`                                      | semantic                          |
| 6   | Payment selection/status   | `phase8i-critical-surfaces.a11y.test.tsx`                            | 390, 1366                         |
| 7   | CUSTOMER profile           | `phase8i-critical-surfaces.a11y.test.tsx`                            | 390, 1366                         |
| 8   | CUSTOMER bookings          | `customer-bookings.a11y.test.tsx`                                    | 390, 1366                         |
| 9   | ADMIN room operations      | `phase8h-operations.a11y.test.tsx`                                   | semantic; browser 390/1366        |
| 10  | ADMIN bookings             | `phase8i-critical-surfaces.a11y.test.tsx`                            | 390, 1366                         |
| 11  | ADMIN payment operations   | `admin-payments-page.test.tsx`, `admin-payment-detail-page.test.tsx` | semantic                          |
| 12  | ADMIN operational report   | `phase8h-operations.a11y.test.tsx`                                   | semantic; browser 390/1366        |
| 13  | Booking confirmation/print | `booking-detail-panel.test.tsx`                                      | semantic; print structure covered |

Results: `AXE_CRITICAL=0`; `AXE_SERIOUS=0`; `CRITICAL_SURFACES_MEASURED=13`; `KEYBOARD_CRITICAL_PATHS=PASS` via the public-homepage and Phase 8D.2 browser tests (locale, account menu, filters), with table text alternatives and print semantics exercised by the component tests. `globals.css` contains the reduced-motion media path.

This is semantic/accessibility measurement, not a visual-layout substitute. The Phase 8I Playwright UAT provides the complementary rendered 390x844 and 1366x768 evidence.
