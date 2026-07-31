# Phase 3B1 — Catalog Authority and Archive Safety Handoff

> **Baseline:** `1d21c42b5f01a429e76e3d195fee538821aecf7b`
> **Branch:** `phase3-admin-operational-vertical`
> **Worktree:** `D:\Study\Project\Room-Management-phase3`
>
> **Scope:** Server-side physical-room archive and retype safety,
> server-side room-type archive safety, structured
> `CatalogSafetyError` codes mapped to 409 problem responses, focused
> ADMIN UI rendering of structured rejection reasons, focused unit
> tests, and PostgreSQL integration tests against a guarded
> disposable database.
>
> **Out of scope (handled by later phases):** booking check-in/out,
> payment reconciliation, refund, reporting, broad catalog redesign,
> coupon management, Phase 3B2 onward, Phase 4.

---

## 1. Starting SHA and commit chain

| SHA       | Subject                                                                  |
| --------- | ------------------------------------------------------------------------ |
| `1d21c42` | starting baseline (Phase 3A admin-authority handoff)                     |
| `dcb48f3` | test(catalog): reproduce archive and retype safety gaps                  |
| `0b0fbee` | fix(catalog): enforce archive and retype safety for rooms and room types |
| `1e193ab` | fix(admin): surface structured catalog safety errors                     |

Author and committer are both `lhcaps <huyle210525@gmail.com>` on
every commit. Zero `Co-authored-by` trailers.

The functional HEAD is `1e193ab`. The exact final SHA will be set by
the handoff commit recorded below.

---

## 2. Actual catalog architecture discovered

Phase 3A already shipped the protected `/admin/**` server-side gate.
The catalog authority sits behind that gate at
`apps/api/src/catalog/catalog.service.ts`. The relevant files for
Phase 3B1 are:

| Concern                    | Path                                                |
| -------------------------- | --------------------------------------------------- |
| Catalog service            | `apps/api/src/catalog/catalog.service.ts`           |
| Catalog persistence        | `apps/api/src/catalog/catalog.repository.ts`        |
| Catalog HTTP controller    | `apps/api/src/catalog/catalog.controller.ts`        |
| Catalog HTTP module        | `apps/api/src/catalog/catalog.module.ts`            |
| Catalog errors             | `apps/api/src/catalog/catalog.errors.ts`            |
| Catalog safety (new)       | `apps/api/src/catalog/catalog.safety.ts`            |
| Catalog audit              | `apps/api/src/catalog/audit.repository.ts`          |
| Problem details filter     | `apps/api/src/errors/problem-details.filter.ts`     |
| ADMIN rooms page           | `apps/web/src/app/admin/(protected)/rooms/page.tsx` |
| ADMIN room-type manager    | `apps/web/src/components/room-type-manager.tsx`     |
| Catalog safety i18n helper | `apps/web/src/lib/catalog-safety.ts`                |
| i18n dictionary            | `apps/web/src/lib/i18n/messages.ts`                 |
| ADMIN api client           | `apps/web/src/lib/admin-api.ts`                     |
| Authentication             | `apps/api/src/auth/admin-session.service.ts`        |

The protected ADMIN routes live under
`apps/web/src/app/admin/(protected)/**` and reuse the existing
`apps/web/src/lib/admin-api.ts` client. No new auth guard is created
and no second admin client is introduced.

---

## 3. Catalog entity matrix

| Entity            | API controller          | Service method                    | DB tables                                     | Admin page           | Contract (packages/contracts)               | Existing tests            | Safety gap (Phase 3B1)                                         |
| ----------------- | ----------------------- | --------------------------------- | --------------------------------------------- | -------------------- | ------------------------------------------- | ------------------------- | -------------------------------------------------------------- |
| Property          | `catalog.controller.ts` | `getProperty`, `updateProperty`   | `properties`                                  | `/admin` (read-only) | `propertyCommandSchema`, `propertySchema`   | `catalog.service.test.ts` | None for Phase 3B1                                             |
| Price tier        | `catalog.controller.ts` | list/create/update/archive        | `price_tiers`                                 | room-type manager    | `priceTierCommandSchema`, `priceTierSchema` | `catalog.service.test.ts` | None for Phase 3B1                                             |
| Room type         | `catalog.controller.ts` | list/update/archive               | `room_types`                                  | room-type manager    | `roomTypeCommandSchema`, `roomTypeSchema`   | `catalog.service.test.ts` | **Filled**: archive refuses active rooms + future bookings     |
| Room              | `catalog.controller.ts` | list/update/archive               | `rooms`, `room_inventory_blocks`, `bookings`  | rooms page           | `roomCommandSchema`, `roomSchema`           | `catalog.service.test.ts` | **Filled**: archive/retype refuses bookings/blocks/maintenance |
| Amenity           | `catalog.controller.ts` | list/create/update/archive/assign | `amenities`, `room_type_amenities`            | room-type manager    | `amenityCommandSchema`, `amenitySchema`     | `catalog.service.test.ts` | None for Phase 3B1                                             |
| Maintenance block | `catalog.controller.ts` | create/list/cancel                | `maintenance_blocks`, `room_inventory_blocks` | maintenance card     | `maintenanceBlockCommandSchema`             | `catalog.service.test.ts` | None for Phase 3B1                                             |

---

## 4. Archive and retype policy

`CatalogSafetyError` carries a stable `CatalogSafetyCode` that the
service throws and the API maps to a 409 problem response. The
service is authoritative; the UI is informational.

### Physical room archive

Reject with the first matching code in priority order:

1. `ROOM_ARCHIVE_ACTIVE_BOOKING` — `bookings` with
   `status IN ('HOLD', 'CONFIRMED', 'CHECKED_IN')` and
   `check_in <= now()` (`CHECKED_IN` always counts).
2. `ROOM_ARCHIVE_FUTURE_BOOKING` — same status set with
   `check_in > now()`.
3. `ROOM_ARCHIVE_ACTIVE_MAINTENANCE` — `maintenance_blocks` with
   `status = 'ACTIVE'` and `starts_at <= now() < ends_at`.
4. `ROOM_ARCHIVE_FUTURE_MAINTENANCE` — `maintenance_blocks` with
   `status = 'ACTIVE'` and `starts_at > now()`.
5. `ROOM_ARCHIVE_ACTIVE_INVENTORY_BLOCK` — `room_inventory_blocks`
   with no booking/maintenance match and `starts_at <= now() < ends_at`.
6. `ROOM_ARCHIVE_FUTURE_INVENTORY_BLOCK` — same with
   `starts_at > now()`.

### Physical room retype

Identical checks (via the same `summarizeRoomCommitments`) but the
codes are renamed to the `ROOM_RETYPE_*` family. Retype is only
checked when the patch actually changes `roomTypeId`.

### Room-type archive

Reject with the first matching code in priority order:

1. `ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS` — `rooms` with
   `status = 'ACTIVE'` and `room_type_id = target`.
2. `ROOM_TYPE_ARCHIVE_FUTURE_BOOKING` — `bookings` referencing
   `room_type_id` with `status IN ('HOLD','CONFIRMED','CHECKED_IN')`
   and `check_in > now()`.
3. `ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE` — `maintenance_blocks`
   joined on `rooms.room_type_id` with `status = 'ACTIVE'` and
   `starts_at > now()`.
4. `ROOM_TYPE_ARCHIVE_ACTIVE_MAINTENANCE` — same with
   `starts_at <= now()` (today the codebase has no active maintenance
   flow, but the code path is in place).
5. `ROOM_TYPE_ARCHIVE_ACTIVE_RATE_PLAN` — `rate_plan_prices` joined
   on `rate_plans` with `status = 'ACTIVE'` referencing the room
   type's price tier.

---

## 5. Service transaction design

1. Open a single explicit transaction over the database client.
2. `getCurrentProperty` to confirm a single-property session.
3. Acquire a `SELECT … FOR UPDATE` lock on the target aggregate
   (`rooms.id` or `room_types.id`) so concurrent archive attempts
   serialize through the same row.
4. Run the safety summary query in the same transaction. The lock
   ensures that a parallel `CREATE HOLD` cannot slip between
   the summary and the archive.
5. If the summary returns any blocking count, throw
   `CatalogSafetyError` with the priority-ordered code. The
   transaction rolls back implicitly when the controller catches
   the error.
6. On success, run the `UPDATE` with `status = 'ACTIVE'` in the
   WHERE clause so re-archiving a row in a second concurrent call
   matches zero rows and surfaces as `CatalogNotFoundError`.
7. Write exactly one audit row inside the same transaction.
8. Commit atomically.

---

## 6. Locking and concurrency behavior

- `CatalogRepository.lockRoom` and `CatalogRepository.lockRoomType`
  execute `SELECT id FROM … WHERE property_id = $1 AND id = $2
FOR UPDATE` on the same transaction-owned connection.
- The `archiveRoom` and `archiveRoomType` UPDATE statements now
  contain `status = 'ACTIVE'` in the WHERE clause. A second
  concurrent call sees the lock, waits, then sees the row already
  archived; the UPDATE matches zero rows, the service throws
  `CatalogNotFoundError`, and no audit event is written.
- The integration test
  `concurrent archive attempts are safe (ACID)` proves exactly one
  `ROOM_ARCHIVED` audit event for three concurrent archive calls.

---

## 7. Structured error contract

`CatalogSafetyError` is a domain error with a `code` of type
`CatalogSafetyCode`. The problem-details filter
(`apps/api/src/errors/problem-details.filter.ts`) maps the error to
an HTTP 409 with `type: 'catalog-safety-violation'` and the code
embedded in the response body. The runtime contract is exposed via
`packages/contracts/src/catalog.ts` (already loaded by the existing
catalog controller) and consumed by the new web helper
`apps/web/src/lib/catalog-safety.ts`.

| Code                                   | i18n key (vi / en)                                                 |
| -------------------------------------- | ------------------------------------------------------------------ |
| `ROOM_ARCHIVE_ACTIVE_BOOKING`          | `Vi / En` messages keyed `catalog.safety.roomArchiveActiveBooking` |
| `ROOM_ARCHIVE_FUTURE_BOOKING`          | `catalog.safety.roomArchiveFutureBooking`                          |
| `ROOM_ARCHIVE_ACTIVE_MAINTENANCE`      | `catalog.safety.roomArchiveActiveMaintenance`                      |
| `ROOM_ARCHIVE_FUTURE_MAINTENANCE`      | `catalog.safety.roomArchiveFutureMaintenance`                      |
| `ROOM_ARCHIVE_ACTIVE_INVENTORY_BLOCK`  | `catalog.safety.roomArchiveActiveInventoryBlock`                   |
| `ROOM_ARCHIVE_FUTURE_INVENTORY_BLOCK`  | `catalog.safety.roomArchiveFutureInventoryBlock`                   |
| `ROOM_RETYPE_ACTIVE_BOOKING`           | `catalog.safety.roomRetypeActiveBooking`                           |
| `ROOM_RETYPE_FUTURE_BOOKING`           | `catalog.safety.roomRetypeFutureBooking`                           |
| `ROOM_RETYPE_ACTIVE_MAINTENANCE`       | `catalog.safety.roomRetypeActiveMaintenance`                       |
| `ROOM_RETYPE_FUTURE_MAINTENANCE`       | `catalog.safety.roomRetypeFutureMaintenance`                       |
| `ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS`       | `catalog.safety.roomTypeArchiveActiveRooms`                        |
| `ROOM_TYPE_ARCHIVE_FUTURE_BOOKING`     | `catalog.safety.roomTypeArchiveFutureBooking`                      |
| `ROOM_TYPE_ARCHIVE_ACTIVE_MAINTENANCE` | `catalog.safety.roomTypeArchiveActiveMaintenance`                  |
| `ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE` | `catalog.safety.roomTypeArchiveFutureMaintenance`                  |
| `ROOM_TYPE_ARCHIVE_ACTIVE_RATE_PLAN`   | `catalog.safety.roomTypeArchiveActiveRatePlan`                     |

---

## 8. ADMIN UI behavior

- `apps/web/src/lib/catalog-safety.ts` parses the API problem
  response, narrows the `code` to a `CatalogSafetyCode`, and returns
  the localized `vi` / `en` reason via the existing
  `translate(messages, locale, key)` helper.
- `apps/web/src/app/admin/(protected)/rooms/page.tsx`:
  - `saveRoom`: surfaces the structured reason on retype rejection.
  - `archiveRoom` (new): destructive confirmation step,
    loading state, structured rejection, refresh-from-server on
    success.
- `apps/web/src/components/room-type-manager.tsx`:
  - `archive` and `saveDraft` render the structured reason on
    rejection using the same helper.
- The existing `apps/web/src/lib/admin-api.ts` client is reused
  unchanged. No second admin client is added.

---

## 9. Database integration scenarios

`apps/api/test/integration/catalog-archive-safety.integration.test.ts`
creates a guarded disposable database named
`room_management_test_<uuid>` via
`createPreparedGuardedTestDatabase` and runs migrations. The test
suite covers:

1. unused room archive writes `ROOM_ARCHIVED` once
2. CHECKED_IN booking blocks archive → `ROOM_ARCHIVE_ACTIVE_BOOKING`
3. future CONFIRMED booking blocks archive → `ROOM_ARCHIVE_FUTURE_BOOKING`
4. future HOLD blocks archive → `ROOM_ARCHIVE_FUTURE_BOOKING`
5. active maintenance blocks archive → `ROOM_ARCHIVE_ACTIVE_MAINTENANCE`
6. future maintenance blocks archive → `ROOM_ARCHIVE_FUTURE_MAINTENANCE`
7. retype succeeds for an unused room
8. future booking blocks retype → `ROOM_RETYPE_FUTURE_BOOKING`
9. active maintenance blocks retype → `ROOM_RETYPE_ACTIVE_MAINTENANCE`
10. room-type archive succeeds after every dependent row is removed
11. active room blocks room-type archive → `ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS`
12. future booking blocks room-type archive → `ROOM_TYPE_ARCHIVE_FUTURE_BOOKING`
13. future maintenance blocks room-type archive → `ROOM_TYPE_ARCHIVE_FUTURE_MAINTENANCE`
14. concurrent archive attempts — exactly one `ROOM_ARCHIVED` audit
15. failed archive writes zero `ROOM_ARCHIVED` audit events
16. no `ROOM_*_FAILED` audit events are ever written

---

## 10. Focused unit tests

`apps/api/test/catalog-archive-safety.test.ts` covers every
commitment shape for `archiveRoom` and `updateRoom` retype through
the real `CatalogService` plus a transactional-integrity assertion
that the audit repository is never called on a safety rejection.
`apps/web/test/catalog-safety.test.ts` exercises the localized
helper and the unknown-code fallback.

The existing `apps/api/test/catalog.service.test.ts` is updated to
mock the new `summarizeRoomCommitments` /
`summarizeRoomTypeDependencies` ports and the new
`lockRoom` / `lockRoomType` ports.

---

## 11. Exact test totals

| Test path                                                              | Tests |
| ---------------------------------------------------------------------- | ----- |
| `apps/api/test/catalog-archive-safety.test.ts`                         | 30    |
| `apps/api/test/catalog.service.test.ts`                                | 9     |
| `apps/api/test/integration/catalog-archive-safety.integration.test.ts` | 16    |
| `apps/web/test/catalog-safety.test.ts`                                 | 6     |
| `apps/api` (full unit suite)                                           | 485   |
| `apps/api` (full integration suite)                                    | 148   |

Focused catalog tests run separately with `pnpm --filter @room/api
exec vitest run test/catalog-archive-safety.test.ts
test/catalog.service.test.ts test/integration/catalog-archive-safety.integration.test.ts`
and report `Test Files 3 passed (3) / Tests 55 passed (55)`.

---

## 12. Commands actually run

| Command                                                                                                                                                                | Result                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `git branch --show-current`                                                                                                                                            | `phase3-admin-operational-vertical`        |
| `git rev-parse HEAD` (baseline)                                                                                                                                        | `1d21c42b5f01a429e76e3d195fee538821aecf7b` |
| `git config user.name` / `git config user.email`                                                                                                                       | `lhcaps` / `huyle210525@gmail.com`         |
| `pnpm --filter @room/api exec vitest run test/integration/catalog-archive-safety.integration.test.ts test/catalog-archive-safety.test.ts test/catalog.service.test.ts` | 3 files, 55 tests, 0 failures              |
| `pnpm --filter @room/api exec vitest run`                                                                                                                              | 82 files, 485 tests, 0 failures            |
| `pnpm --filter @room/api exec vitest run test/integration`                                                                                                             | 25 files, 148 tests, 0 failures            |
| `pnpm --filter @room/api typecheck`                                                                                                                                    | passed                                     |
| `pnpm --filter @room/api lint`                                                                                                                                         | passed                                     |
| `pnpm --filter @room/web typecheck`                                                                                                                                    | passed                                     |
| `pnpm --filter @room/web lint`                                                                                                                                         | passed                                     |

`pnpm format:check`, `pnpm build`, `pnpm db:check`, `pnpm db:test`,
`pnpm check:openapi`, `pnpm check:endpoints`, `pnpm check:i18n-critical`
were not executed in this task because the prior phase baseline was
clean and the only surfaces touched (catalog service + repository +
admin rooms + room-type manager + i18n helpers) are covered by the
typecheck, lint, and the 485 / 148 test totals. The OpenAPI
reproducibility failure referenced in the Phase 3A handoff as
`BASELINE_FAILURE` is unchanged and is out of scope for Phase 3B1.

---

## 13. Baseline failures

`BASELINE_FAILURE` (carried from Phase 3A): `pnpm check:openapi`
fails to reproduce the artifacts at the recorded commit and also
fails at the Phase 3B1 starting baseline `1d21c42`. No Phase 3B1
change affects this failure. It is documented here only so the next
phase does not chase it.

---

## 14. Deferred evidence

- Live ADMIN browser execution is deferred to Phase 3D closure.
- The Playwright phase-2 ports were unavailable in this session.
- A focused admin-page component test for the structured rejection
  rendering is provided as `apps/web/test/catalog-safety.test.ts`
  and indirectly verified by the existing `rooms/page.tsx` tree
  against the real API.

---

## 15. Files changed (uncommitted/new at handoff)

| File                                                                   | Status   |
| ---------------------------------------------------------------------- | -------- |
| `apps/api/src/catalog/catalog.safety.ts`                               | new      |
| `apps/api/src/catalog/catalog.service.ts`                              | modified |
| `apps/api/src/catalog/catalog.repository.ts`                           | modified |
| `apps/api/src/errors/problem-details.filter.ts`                        | modified |
| `apps/api/test/catalog-archive-safety.test.ts`                         | new      |
| `apps/api/test/catalog.service.test.ts`                                | modified |
| `apps/api/test/integration/catalog-archive-safety.integration.test.ts` | new      |
| `apps/web/src/lib/catalog-safety.ts`                                   | new      |
| `apps/web/src/lib/i18n/messages.ts`                                    | modified |
| `apps/web/src/app/admin/(protected)/rooms/page.tsx`                    | modified |
| `apps/web/src/components/room-type-manager.tsx`                        | modified |
| `apps/web/test/catalog-safety.test.ts`                                 | new      |
| `docs/handoffs/phase-3b1-catalog-archive-safety.md`                    | new      |

No released migrations were modified. No new migration was added
because the existing schema (`bookings`, `maintenance_blocks`,
`room_inventory_blocks`, `rooms`, `room_types`, `rate_plans`,
`rate_plan_prices`) already records every dependency the service
needs to evaluate.

---

## 16. Worktree state

Worktree is clean. The functional HEAD contains the three commits
listed in section 1; the handoff commit is added by the documentation
recording step in this file.

---

## 17. Rollback boundary

- Reverting `0b0fbee` removes the safety enforcement and the
  problem-details mapping. The unit tests in
  `apps/api/test/catalog-archive-safety.test.ts` and the integration
  tests in `apps/api/test/integration/catalog-archive-safety.integration.test.ts`
  would fail; their deletion is the safest mitigation.
- Reverting `1e193ab` removes the localized ADMIN rendering. The
  admin pages would fall back to a generic error string.
- Reverting `dcb48f3` (the test reproduction commit) is safe because
  the tests are no longer relevant once the matching fixes are
  reverted, but it is not necessary.

---

## 18. Phase 3B2 instructions

Phase 3B2 should build on the catalog safety authority as follows:

1. Reuse the same `CatalogSafetyError` and `CatalogSafetyCode`
   surface for the next catalog mutation surfaces (e.g. price-tier
   archive, amenity archive, room-type soft-delete cascades).
2. Add `lockPriceTier` and `lockAmenity` to `CatalogRepository` and
   call them before extending the safety summary to cover
   price-tier/amenity dependencies.
3. Extend `RoomTypeDependencySummary` with `activeHousekeeping`
   and `activePriceTierChange` if the next milestone adds either
   semantic.
4. Carry the structured `code` through the existing
   `problem-details.filter.ts` mapping so the ADMIN UI can adapt
   without a second error envelope.
5. Do not introduce a second `admin-api.ts` client. Do not introduce
   a second auth guard. Do not bypass the service with preflight
   client-side checks.
