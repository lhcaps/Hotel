# PeaceNest Room Operations and Housekeeping Domain Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the independent room, occupancy, maintenance, housekeeping-condition, and task-work semantics; expose every housekeeping task through a task-first API/workboard; and enforce transactional assignment, lifecycle, override, RBAC, audit, and inventory invariants without changing production data.

**Architecture:** Keep `rooms.status`, booking-derived occupancy, `rooms.housekeeping_status`, maintenance blocks, and `housekeeping_tasks` as separate authorities. Add task-addressed service/repository operations and a task-first response contract, then make room-level convenience actions delegate to the same task service. Derive room display groups from housekeeping condition rather than task presence, and make manual overrides reconcile TURNOVER work atomically with audit evidence.

**Tech Stack:** TypeScript, NestJS, Drizzle/PostgreSQL, Zod contracts, React/Next.js admin UI, Vitest, PostgreSQL integration tests, Playwright.

## Global Constraints

- Work only in `D:\Study\Project\Room Management` on `main`; do not create branches/worktrees or use stash/reset/clean/rebase/amend/force-push.
- Preserve unrelated modified and untracked files; stage only exact paths.
- Do not mutate production data during audit or implementation; production deployment is explicitly `NO`.
- Keep activation, occupancy, housekeeping condition, maintenance, and task work as independent axes.
- Keep internal profile code `HOUSEKEEPING_MANAGER`; visible Vietnamese label is exactly `Bu phong` in source encoding as the intended `Bù phòng` label.
- No direct SQL business mutation from UI or scripts; transactional SQL belongs only in governed repository/domain services.
- Peace Home inventory remains exactly the 23 codes in `packages/database/src/client-room-import.ts`.

---

### Task 1: Capture baseline production and local truth

**Files:**
- Create: `docs/operations-v3/HOUSEKEEPING_STATE_AUDIT.md`
- Test/fixtures only if needed: `apps/api/test/booking/room-operations.service.test.ts`

**Interfaces:**
- Consumes: current production PostgreSQL read-only data, `CLIENT_ROOM_MANIFEST`, current room-operations response and housekeeping task rows.
- Produces: explicit `SOURCE_FACT`, `DB_FACT`, `DERIVED_FACT`, and `DEFECT` sections plus baseline contradiction counts.

- [ ] Read the specified housekeeping, schema, permission, contract, API, repository, UI, and manifest files and record the current behavior and all relevant identifiers.
- [ ] Run a read-only production query joining all Peace Home rooms, room types/tiers, bookings, maintenance blocks, housekeeping tasks, users, admin memberships, and property memberships; emit one row per room/task without exposing secrets.
- [ ] Compare production physical room codes and room numbers to the 23-room manifest, classify duplicate/invalid inventory, and calculate every required contradiction metric.
- [ ] Run the existing room-operations and housekeeping unit/integration tests to establish the baseline failures before edits.
- [ ] Write the audit with exact command timestamps, counts, and no guessed repairs.

### Task 2: Make room-operation derivation and contracts semantically correct

**Files:**
- Modify: `apps/api/src/booking/services/room-operations.service.ts`
- Modify: `apps/api/src/booking/repositories/room-operations.repository.ts`
- Modify: `packages/contracts/src/admin-room-operations.ts`
- Modify: `apps/api/src/booking/room-operations.controller.ts` only if diagnostics/task payloads need a route contract
- Test: `apps/api/test/booking/room-operations.service.test.ts`
- Test: `apps/api/test/booking/room-operations.repository.integration.test.ts` or the existing repository integration analogue

**Interfaces:**
- Consumes: `RoomOperationRow` and separate housekeeping task rows.
- Produces: `deriveRoomDisplayGroup()` that maps vacant DIRTY to `needs_cleaning`, vacant CLEANING to `cleaning`, vacant CLEAN+arrival to `arrival`, and vacant CLEAN to `ready`; diagnostics expose impossible task/room combinations instead of hiding them.

- [ ] Add `needs_cleaning` to the response enum and a consistency diagnostic shape that identifies task id/type/status and room condition.
- [ ] Change derivation so ARRIVAL_PREP presence never changes CLEAN to cleaning/needs-cleaning; use housekeeping status as the authoritative condition.
- [ ] Keep occupied/checkout/maintenance/inactive priority unchanged and make ready require ACTIVE, no maintenance, VACANT, CLEAN, and no blocking consistency defect.
- [ ] Update repository projection to return all relevant active task candidates for diagnostics rather than relying on one ambiguous active task where the contract needs them.
- [ ] Add unit tests for CLEAN + ARRIVAL_PREP DUE/assigned, DIRTY/CLEANING contradictions, maintenance/occupancy combinations, and duplicate/invalid task diagnostics.

### Task 3: Add task-first housekeeping contracts, repository transactions, and API

**Files:**
- Modify: `packages/contracts/src/admin.ts`
- Modify: `packages/contracts/src/admin-room-operations.ts`
- Modify: `apps/api/src/catalog/catalog.service.ts`
- Modify: `apps/api/src/catalog/catalog.repository.ts`
- Modify: `apps/api/src/catalog/catalog.controller.ts`
- Modify: `apps/api/src/booking/repositories/room-operations.repository.ts` if shared task projection is extracted
- Modify: `apps/web/src/lib/admin-api.ts`
- Test: `apps/api/test/catalog/housekeeping.service.test.ts`
- Test: `apps/api/test/catalog/housekeeping.integration.test.ts`

**Interfaces:**
- Consumes: `housekeeping_tasks` rows and actor/property context.
- Produces: task-addressed list/get/assign/start/complete/verify/reopen operations keyed by `taskId`, with room-level endpoints delegating only when a unique task is explicitly resolved.

- [ ] Define strict task-first schemas containing task id, room id/number, room type/concept, type, room condition, lifecycle status, assignee, due time, version, verification, and allowed actions.
- [ ] Add `GET /api/v1/admin/housekeeping/tasks` with type/status/property filters and deterministic task ordering; include ARRIVAL_PREP and TURNOVER independently.
- [ ] Add task-addressed mutation routes for assignment/reassignment, start, complete, verify, and reopen; reject room-only ambiguous mutation requests.
- [ ] Implement repository transactions with `FOR UPDATE`, expected-version checks, same-property active membership checks, and task-type-specific state transitions.
- [ ] Ensure TURNOVER start atomically changes task to IN_PROGRESS and room to CLEANING; complete atomically changes task to DONE and room to CLEAN; ARRIVAL_PREP mutations never change room housekeeping condition.
- [ ] Preserve verification as metadata-only and make reopen reconcile task/room state based on reason and current occupancy.
- [ ] Keep existing room routes as compatibility adapters only where they resolve one explicit TURNOVER task; remove “first active task” mutation behavior.

### Task 4: Implement manual housekeeping override and RBAC/audit guarantees

**Files:**
- Modify: `packages/contracts/src/admin.ts`
- Modify: `apps/api/src/catalog/catalog.service.ts`
- Modify: `apps/api/src/catalog/catalog.repository.ts`
- Modify: `apps/api/src/catalog/catalog.controller.ts`
- Modify: `packages/auth/src/permissions.ts`
- Modify: `apps/web/src/lib/i18n/messages.ts`
- Test: `apps/api/test/catalog/housekeeping.service.test.ts`
- Test: `apps/api/test/catalog/housekeeping.rbac.integration.test.ts`

**Interfaces:**
- Consumes: actor profile, property scope, room id, target condition, required reason, and optional related task id.
- Produces: `PATCH /api/v1/admin/rooms/:id/housekeeping/override` that atomically reconciles TURNOVER work and writes a complete audit event.

- [ ] Require a non-empty reason for every manager/super-admin manual override.
- [ ] For DIRTY, reuse/reopen or create exactly one actionable TURNOVER; for CLEANING, require/reconcile one IN_PROGRESS TURNOVER; for CLEAN, complete/reconcile any DUE/IN_PROGRESS TURNOVER without leaving dangling work.
- [ ] Reject manual state changes that would leave task/room contradictions, and audit actor, room, previous/new state, reason, related task id, and timestamp.
- [ ] Preserve HOUSEKEEPING_STAFF restrictions: assigned work only, no assignment/reassignment, no arbitrary override; allow SUPER_ADMIN and HOUSEKEEPING_MANAGER to assign/reassign/start/complete/verify/reopen/override per policy.
- [ ] Validate assignment candidates are ACTIVE users with ACTIVE HOUSEKEEPING_STAFF membership in the same property; reject wrong-property, inactive, and non-housekeeping users.
- [ ] Change the visible HOUSEKEEPING_MANAGER label to exactly `Bù phòng` without changing the stable profile enum/code.

### Task 5: Replace the room-centric workboard and clean room-operation presentation

**Files:**
- Modify: `apps/web/src/components/housekeeping-workboard.tsx`
- Modify: `apps/web/src/components/room-operations-board.tsx`
- Modify: `apps/web/src/components/room-housekeeping-manager.tsx`
- Modify: `apps/web/src/components/room-detail-admin.tsx`
- Modify: `apps/web/src/lib/admin-api.ts`
- Modify: `apps/web/src/lib/i18n/messages.ts`
- Test: `apps/web/src/components/housekeeping-workboard.test.tsx`
- Test: `apps/web/src/components/room-operations-board.test.tsx`
- Test: `tests/e2e/housekeeping-workboard.spec.ts`

**Interfaces:**
- Consumes: task-first API rows and room-operation rows with independent axes/diagnostics.
- Produces: task-first responsive board with separate TURNOVER/ARRIVAL_PREP filtering and non-duplicative room labels.

- [ ] Render one row per durable task with columns `Phòng`, `Loại phòng`, `Loại công việc`, `Tình trạng vệ sinh`, `Trạng thái công việc`, `Nhân viên`, `Đến hạn`, and `Thao tác`.
- [ ] Split/filter `Dọn phòng` (TURNOVER) from `Chuẩn bị nhận phòng` (ARRIVAL_PREP), and address every mutation by task id/version.
- [ ] Render compact room identity as `Phòng G03` plus `Haven · Signature`, with technical physical code muted and separated only when useful.
- [ ] Render operational, housekeeping, and work labels as separate axes; never show contradictory labels without the diagnostic explanation.
- [ ] Add manager/staff action visibility and responsive mobile/desktop layouts with loading, empty, error, and consistency-defect states.
- [ ] Add browser assertions for no concatenated room labels, task-first rows, mobile usability, and manager/staff action boundaries.

### Task 6: Run full verification and post-change local audit

**Files:**
- Modify: `docs/operations-v3/HOUSEKEEPING_STATE_AUDIT.md`
- Create if needed: `docs/operations-v3/HOUSEKEEPING_STATE_AUDIT_AFTER.md`

**Interfaces:**
- Consumes: all changed source, tests, generated OpenAPI, local PostgreSQL integration database, and the same production read-only audit query.
- Produces: green local gates and before/after integrity report; production remains untouched.

- [ ] Run format, lint, typecheck, contracts, unit, PostgreSQL integration, RBAC, room-operations, housekeeping, Playwright, OpenAPI generation/check, and migration checks when applicable.
- [ ] Re-run the exact production read-only audit query and record `ROOM_COUNT`, duplicate codes, invalid assignments, turnover contradictions, ARRIVAL_PREP display influence, and ambiguous mutation counts without repairing rows.
- [ ] If production defects remain, write an exact governed repair plan with before/after evidence and do not mutate production.
- [ ] Review the complete diff and confirm no unrelated files were staged.

### Task 7: Commit, push, and verify CI without deployment

**Files:**
- Exact-path staging only for changed implementation, tests, docs, and generated contract artifacts.

**Interfaces:**
- Consumes: verified local implementation and audit artifacts.
- Produces: one main commit, exact `origin/main` SHA, hosted CI success, and final report with `PRODUCTION_DEPLOYED=NO`.

- [ ] Stage only exact changed paths; do not stage the pre-existing release/audit/untracked files.
- [ ] Commit to `main` with a focused domain-fix message.
- [ ] Push `main`, verify `HEAD == origin/main`, wait for hosted CI on the exact SHA, and record its URL/status.
- [ ] Do not invoke any production deployment or production mutation command.
