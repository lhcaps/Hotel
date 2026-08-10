# Project failure ledger

This append-only ledger records every discovered failure, its evidence-based
root-cause investigation, corrective change, and regression proof. A passing
rerun does not erase the original failure record.

## FAIL-CI-E2E-001

| Field             | Value                                                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DISCOVERED_AT     | 2026-08-10                                                                                                                                                                                                |
| AREA              | Customer edge: public coupon / guest OTP / mobile                                                                                                                                                         |
| SEVERITY          | P1 / BLOCKER_PUBLIC                                                                                                                                                                                       |
| SYMPTOM           | Hosted CI run `31343502129` failed `tests/e2e/phase6d-public-coupon.spec.ts:581` after 167 tests passed. After clicking `Gửi mã xác nhận`, the generic acknowledgement was not visible within 10 seconds. |
| ROOT_CAUSE_STATUS | CONFIRMED — the assertion targets text owned by the request panel; a fast successful response can replace the panel with verification state before the assertion observes it.                             |
| DEPENDENCIES      | Guest OTP request panel, manage-page state transition, mobile E2E flow                                                                                                                                    |
| BLOCKS_WHAT       | Hosted E2E, hosted full pipeline, release-candidate readiness                                                                                                                                             |
| PLANNED_WAVE      | Wave 2 — Customer Edge / OTP / Booking                                                                                                                                                                    |
| RESOLUTION        | Attempt 1 of 3: retain the generic, non-enumerating acknowledgement in the mounted verification state after successful OTP request. No timeout/retry/skip/assertion weakening.                            |
| VERIFICATION      | `apps/web/test/otp-panels.test.tsx`: 14/14 PASS; focused mobile coupon/OTP Playwright: 1/1 PASS. Full local E2E and hosted CI pending.                                                                    |
