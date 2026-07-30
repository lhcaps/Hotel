# Phase 8H Independent Review

Date: 2026-07-29
Reviewed HEAD at start: `7cc63aa7d7c67d78dafbdea40018dc7b9e6ff1c8`
Method: trace implementation, contract, authorization, persistence and deterministic test; Phase 8H documentation was not accepted as implementation proof.

| Capability | Implementation and authority | Route / authorization | Evidence | Verdict |
|---|---|---|---|---|
| Housekeeping | `rooms.housekeeping_status`; `room-housekeeping-manager.tsx` | `PATCH /api/v1/admin/rooms/:id/housekeeping`; ADMIN `catalog.room.manage` | Phase 8H browser/a11y tests and DB schema | PASS |
| Room operations | `RoomOperationsRepository` shapes room occupancy, maintenance and housekeeping server-side | `GET /api/v1/admin/room-operations`; ADMIN booking read boundary | `room-operations-board.tsx` and `phase-8h-room-operations.spec.ts` | PASS |
| Booking operations | Existing booking lifecycle and review modules | ADMIN booking routes guarded by permissions | `phase-7g-admin-booking-operations.spec.ts` remains exercised by full suite | PASS |
| Tier/rate-plan and extra-hour presentation | `rate_plans` and `rate_plan_prices` remain pricing authority | Existing ADMIN catalog / public quote contracts | rate-plan browser and pricing regression families | PASS |
| Confirmation print | `BookingDetailPanel` uses safe detail projection and `window.print()` | CUSTOMER/guest authorization remains server-side | `booking-detail-panel.test.tsx`; Phase 8I confirmation acceptance remains to be added | PARTIAL_EVIDENCE |
| Operational reporting | `AdminOperationalReportRepository` performs PostgreSQL aggregate queries; client renders response only | `GET /api/v1/admin/operational-report`; `booking.lifecycle.read` | service/repository/controller tests, report dashboard and Phase 8H E2E | PARTIAL_METRIC_FIXTURES_REQUIRED |
| Sanitized demo seed | `packages/database/src/seed-development.ts` | development-only loopback guard | Phase 8I integration seed test | PASS |
| Customer non-disclosure | Board response omits contact; confirmation parity matrix prohibits physical room, source, employee, housekeeping, UUID and raw provider data | CUSTOMER/guest detail authorization | route contracts plus detail panel tests | PARTIAL_CONFIRMATION_BROWSER_PROOF_REQUIRED |
| Workbook redaction | `docs/audit/phase-8h/client-workbook-parity-matrix.md` records only structural review | No workbook artifact is tracked | `git ls-files` review required at final closure | PASS_PENDING_FINAL_TREE |

## Preserved domain boundaries

- `PARTIAL_PAYMENT=DOMAIN_CHANGE_REQUIRED_DEFERRED`
- `SOURCE_ATTRIBUTION=DEFERRED`
- `EMPLOYEE_ATTRIBUTION=DOMAIN_CHANGE_REQUIRED_STAFF_IDENTITY`
- `MULTI_PROPERTY=SINGLE_PROPERTY_MATCHED`

The review found one repository-owned defect in the Phase 8H endpoint evidence checker: a comment was parsed as an additional runtime route. It is fixed by commit `46173eb` with a focused regression test. Remaining PARTIAL rows are evidence gaps, not grounds for unsupported business-scope changes.
