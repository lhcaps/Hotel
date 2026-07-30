# Phase 8I client UAT checklist

Use only synthetic data from `docs/runbooks/client-uat-data.md`. Mark each line `PASS`, `FAIL`, `BLOCKED_EXTERNAL`, or `NOT_APPLICABLE`.

## Public booking

1. Open `/`; search 2027-07-10 11:00 to 14:00 and confirm available room types.
2. Select a room, inspect quote, stay-time recommendation, and apply a recommendation.
3. Enter synthetic contact data, create a HOLD, confirm countdown, and continue to payment selection.

## Customer

1. Complete Google login manually only when the local provider checkpoint is available; otherwise mark `BLOCKED_EXTERNAL`.
2. Confirm account menu replaces login, edit profile, save, reload, and open bookings/detail.
3. Print the confirmation and log out; confirm no token appears in the URL.

## ADMIN and operations

1. Sign in, inspect rooms, tiers, rate plans, and extra-hour pricing; edit only a permitted development fixture and reload.
2. On room operations select a date, inspect occupancy/maintenance, change housekeeping, refresh, and confirm persistence without CUSTOMER disclosure.
3. Filter ADMIN bookings by synthetic code, inspect safe contact/pricing/payment data, and open the safe print confirmation.

## Reporting

1. Select 2027-07-10 to 2027-07-14; confirm metrics, trend, table fallback, and updated time.
2. Select an outside-July-2027 range; confirm the empty state is truthful.

## External gates

Google, VNPAY, MoMo, and SMTP must retain the exact status in `external-acceptance-report.md`; never convert configuration readiness into a UAT pass.
