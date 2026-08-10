# W6 multi-property authorization implementation design

Status: APPROVED FOR IMPLEMENTATION (evidence-based reconciliation complete).
Scope: closes ORIG-F-001 through ORIG-F-006.
Authority order used below: current schema/source > 04_RBAC_MATRIX.md >
07_MULTI_PROPERTY_SPEC.md > ORIGINAL_REQUIREMENTS_SUMMARY.txt.

## 1. Evidence baseline (current source, exact citations)

- `admin_departments` (`packages/database/src/schema.ts:228-243`), `admin_profiles`
  (`schema.ts:245-262`), `admin_memberships` (`schema.ts:264-295`) exist. None of the
  three has a `property_id` column. `admin_memberships` unique key is
  `(user_id, department_id)` (`schema.ts:286`) and role is
  `admin_role ∈ {ADMIN, SUPER_ADMIN, ROOM_STATUS_VIEWER}` (`schema.ts:70`).
- `properties` (`schema.ts:312-345`) is a single flat table with no tenant/org
  parent. Almost every domain table (`rooms`, `roomTypes`, `bookings`, `quotes`,
  `payments`, `accessCredentials`, `maintenanceBlocks`, `housekeepingTasks`,
  `coupons`, `ratePlans`, `pricingPolicyVersions`, `roomInventoryBlocks`,
  `couponDeliveryRequests`, `operationalReviews`) carries a NOT NULL
  `property_id` and is composite-FK'd back to `properties`/parent aggregates on
  `(property_id, id)` pairs (e.g. `bookings_property_room_id_uq`,
  `schema.ts:~1175`). `auditEvents.propertyId` and `outboxEvents.propertyId`
  are nullable (system-wide events are legitimate).
- `PropertyContextService.getCurrent()`
  (`apps/api/src/catalog/property-context.service.ts:21-35`) and its
  repository-local equivalents (`CatalogRepository.getCurrentProperty`,
  `apps/api/src/catalog/catalog.repository.ts:79-89`; `CouponRepository`,
  `RatePlanRepository`, `PricingPolicyRepository`,
  `PublicRoomCatalogRepository`, `AvailabilityRepository`,
  `NearbyAvailabilityRepository`, `QuoteRepository`,
  `MultiNightOfferService`, `RecommendationRepository`,
  `PaymentProviderSettingsService`) all resolve
  "the single `status='ACTIVE'` property ordered by `createdAt`" and are never
  handed an actor or a request-derived property id.
- `ActorContext` (`apps/api/src/auth/actor-context.ts:7-22`) and `AdminAccess`
  (`apps/api/src/auth/admin-session.service.ts:2-9`) carry no property field.
  `AdminPermissionGuard.canActivate`
  (`apps/api/src/auth/admin-permission.guard.ts:31-49`) checks only permission
  strings, never a property.
- No admin or public route reads a client-supplied `propertyId`/`propertyCode`
  path or query parameter anywhere in `apps/api/src` (verified by exhaustive
  grep across every `.controller.ts`). Property is always server-resolved.
  This means today there is **no existing client-property-id attack surface to
  retrofit** — the gap is that the server resolves the _wrong_ thing (first
  active property) rather than an _authorized_ thing.
- Workers (`apps/worker/src/jobs/*.ts`) never call `PropertyContextService`;
  they derive `property_id` from the authoritative row they already locked
  (booking, task, credential). No change is required there.
- No cache key in the repository includes `propertyId` (only cache is the
  in-process Google-description-translator memo,
  `apps/api/src/translation/google-description-translator.ts:32-34`, which is
  locale/content-hash keyed, not property-keyed). No change required there.
- Local database currently has exactly one property with a full-strength
  admin (`SUPER_ADMIN` membership on `Vận hành` department created by
  migration 0028's backfill DO-block) — `LOCAL_DEVELOPMENT_EVIDENCE_ONLY`, not
  authority, but consistent with `07_MULTI_PROPERTY_SPEC.md`'s statement that
  "the local database has two active properties" being development-only
  evidence too.

## 2. Reconciliation against Phase A authority

`04_RBAC_MATRIX.md` states: "There is no property column on
`admin_memberships`; current property scope is the selected/current property
boundary, not a complete multi-property membership model" and "Add property
membership/scope only if the existing admin membership model cannot express
it; do not infer property scope from department name." — confirmed true by
source. `07_MULTI_PROPERTY_SPEC.md` states the target: every request, cache
key, job, provider setting, audit event, quote, booking, payment, access
entitlement, room, maintenance block, and housekeeping task must have one
server-authorized property context; a booking cannot span properties;
cross-property booking, room movement, and shared inventory are rejected by
default.

**Decision: the existing membership model (`admin_memberships`) cannot
express property scope** — it has no property column and its uniqueness key
is `(user_id, department_id)`, which is orthogonal to property. Per
`07_MULTI_PROPERTY_SPEC.md`'s explicit permission ("Add property
membership/scope ONLY after proving the existing membership model cannot
correctly express the required property authority"), a new table is
justified. It extends (does not replace) the existing
department/permission-profile architecture per `04_RBAC_MATRIX.md`.

## 3. Schema design (ORIG-F-001, ORIG-F-006)

New forward migration `0034_admin_property_memberships.sql` (Drizzle-generated
from a new `adminPropertyMemberships` table added to `schema.ts`). Released
migrations 0000-0033 are untouched.

```sql
CREATE TABLE admin_property_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- NULL property_id == explicit ALL-PROPERTY authority grant (still an
  -- explicit row, never inferred). Distinct from SUPER_ADMIN, which already
  -- has implicit global authority via ROLE_PERMISSIONS and needs no row here.
  property_id uuid REFERENCES properties(id) ON DELETE RESTRICT,
  status admin_membership_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT admin_property_memberships_revoked_at_ck CHECK (
    (status = 'ACTIVE' AND revoked_at IS NULL) OR
    (status = 'REVOKED' AND revoked_at IS NOT NULL)
  )
);
-- one active row per (user, property) including the ALL-PROPERTY (NULL) row
CREATE UNIQUE INDEX admin_property_memberships_user_property_active_uq
  ON admin_property_memberships (user_id, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'ACTIVE';
CREATE INDEX admin_property_memberships_user_status_idx ON admin_property_memberships (user_id, status);
```

Rationale for design choices:

- **Additive table, not a column on `admin_memberships`.** Department
  membership and property membership are orthogonal per
  `07_MULTI_PROPERTY_SPEC.md` ("department membership alone is NOT a
  permission grant" / RBAC doc: "do not infer property scope from department
  name"). A single admin can be scoped to a property set independent of which
  department(s) they belong to.
  `admin_property_memberships` has FOOTPRINT identical in spirit to
  `admin_memberships` (append-only revoke pattern, `ACTIVE`/`REVOKED` status,
  restrict-delete FKs) to match existing conventions exactly.
- **`property_id` nullable = explicit ALL-PROPERTY grant (ORIG-F-001).**
  `SUPER_ADMIN` already has an explicit global permission set via
  `ROLE_PERMISSIONS.SUPER_ADMIN = PERMISSIONS`
  (`packages/auth/src/permissions.ts:87`) and per
  `04_RBAC_MATRIX.md`/instructions, "SUPER_ADMIN remains the existing explicit
  global authority unless source requirements prove otherwise" — so
  `SUPER_ADMIN` does **not** need an `admin_property_memberships` row; its
  global authority is derived the same way it always has been (role-based).
  A non-SUPER_ADMIN admin profile (`ROOM_STATUS_VIEWER` today, and any future
  `PROPOSED` profile from `04_RBAC_MATRIX.md`) that legitimately needs
  all-property visibility gets an explicit `property_id IS NULL` row — never
  an inferred default.
- **Backfill (ORIG-F-006).** A same-migration DO-block backfills exactly one
  `ACTIVE` row per existing admin/room-status-viewer user, pointing at
  whichever property `PropertyContextService.getCurrent()` would have
  resolved at backfill time (the sole existing `ACTIVE` property in every
  currently known environment). This preserves current behavior for every
  existing admin (no lockout) and preserves the approved 23 physical rooms
  (no room/property data is touched by this migration — it only adds
  membership rows). A guarded integration test asserts room count stays 23
  after migration.

## 4. ActorContext / AdminAccess extension (ORIG-F-001, ORIG-F-002)

Extend (not replace) the existing types:

- `AdminAccess` (`admin-session.service.ts:2-9`) gains
  `readonly propertyIds: readonly string[] | 'ALL'` — `'ALL'` for an explicit
  all-property row or for `SUPER_ADMIN`; otherwise the exact list of
  `property_id`s with an `ACTIVE` `admin_property_memberships` row.
- `ActorContext` (`actor-context.ts:7-22`) gains the same
  `propertyIds: readonly string[] | 'ALL'` field, always populated
  server-side inside `AdminSessionService.getActor()`
  (`admin-session.service.ts:37-61`) — never read from the request.
- `createAuthUserReader().findAdminAccess()`
  (`auth.providers.ts:38-76`) loads `admin_property_memberships` alongside
  `admin_memberships` and computes `propertyIds`. `SUPER_ADMIN` short-circuits
  to `'ALL'` without querying the new table (preserves "SUPER_ADMIN remains
  the existing explicit global authority").
- Legacy `ADMIN` role (no active admin/room-status-viewer membership) keeps
  `propertyIds: []` — it already has zero permissions
  (`ROLE_PERMISSIONS.ADMIN = []`), so this is inert but keeps the type total.

## 5. Server-derived property context (ORIG-F-002)

Replace `PropertyContextService.getCurrent()`'s no-argument, actor-blind
signature with an actor-aware resolver. Exact algorithm (this is the
authorization boundary — precision matters):

```text
resolvePropertyContext(actor, requestedPropertyId?):
  1. if actor.propertyIds !== 'ALL' and actor.propertyIds.length === 0:
       throw ForbiddenException PROPERTY_ACCESS_DENIED   // zero-property actor
  2. candidateIds =
       actor.propertyIds === 'ALL' ? (all ACTIVE property ids) : actor.propertyIds
  3. if requestedPropertyId is provided:
       if actor.propertyIds !== 'ALL' and requestedPropertyId not in actor.propertyIds:
         throw ForbiddenException PROPERTY_ACCESS_DENIED   // hostile UUID substitution
       property = load ACTIVE property by requestedPropertyId
       if property is undefined: throw NotFoundException PROPERTY_NOT_FOUND
       return property
  4. // no explicit selector: safe single-property resolution only
     activeCandidates = candidateIds ∩ (all ACTIVE property ids)
     if activeCandidates.length === 1: return that property
     if activeCandidates.length === 0: throw PropertyContextError PROPERTY_NOT_FOUND
     // activeCandidates.length > 1 (multi-property actor, no explicit context)
     throw ConflictException PROPERTY_CONTEXT_REQUIRED
```

This directly implements every adversarial-test requirement in the task
prompt: member-A-read/mutate-A allowed, member-A-read/mutate-B denied,
hostile-B-UUID-substitution denied, multi-property actor with explicit
selection allowed for both A and B, single-property actor without explicit
context safely resolves that one property, multi-property actor without
explicit context is denied (never silently first-active), zero-property actor
denied, SUPER_ADMIN retains existing global authority (`'ALL'` bypasses the
membership-emptiness check).

Implementation shape: `PropertyContextService.getCurrent(actor,
requestedPropertyId?)` becomes the single canonical resolver; every
`repository.getCurrentProperty()` duplicate (`CatalogRepository`,
`CouponRepository`, `RatePlanRepository` — note this one is missing the
`status='ACTIVE'` filter today, `apps/api/src/pricing/rate-plan.repository.ts:92-98`,
which this refactor also fixes — `PricingPolicyRepository`,
`PublicRoomCatalogRepository`, `AvailabilityRepository`,
`NearbyAvailabilityRepository`, `QuoteRepository`, `MultiNightOfferService`,
`RecommendationRepository`, `PaymentProviderSettingsService`) is replaced with
a call through the one shared resolver so there is exactly one implementation
of "which property" logic in the codebase (closes the divergent-predicate bug
class noted in the research pass).

Public/customer-facing repositories (`PublicRoomCatalogRepository`,
`AvailabilityRepository`, `NearbyAvailabilityRepository`,
`RecommendationRepository`, `QuoteRepository`, `MultiNightOfferService`) have
no actor and no authorization boundary — they keep today's "the one active
property" resolution (single-property-only, B0-compatible, matches
`07_MULTI_PROPERTY_SPEC.md`'s B0 boundary: "B0 remains single-current-property
compatible"). If more than one property is ever `ACTIVE` in production, public
surfaces are out of scope for this phase and continue to require a single
active property (existing invariant, unchanged — B0 does not enable public
multi-property browsing).

## 6. Cross-property rejection at query/mutation boundaries (ORIG-F-003)

Every admin controller that currently injects `PropertyContextService` or a
repository `getCurrentProperty()` is updated to pass
`request.actor` through to the new resolver. Because **no route today reads a
client-supplied `propertyId`**, F-003 for the current route surface reduces to
two concrete changes:

1. The resolver itself is actor-checked (section 5) so a multi-property actor
   can no longer silently receive property A when they intended B.
2. Any aggregate id accepted as a route/body parameter (`bookingCode`,
   `paymentId`, room/coupon/rate-plan ids, etc.) must resolve to a row whose
   `property_id` matches the actor's authorized `resolvePropertyContext()`
   result — not just "the current property." Repositories that look up an
   aggregate by id (`AdminBookingRepository`, `RoomOperationsRepository`,
   `AdminPaymentRepository`, `CatalogRepository`'s room/room-type/amenity
   lookups, `CouponRepository`, `RatePlanRepository`,
   `PricingPolicyRepository`) add `AND property_id = $authorizedPropertyId` to
   their `WHERE` clause (most already filter by `property_id` from the
   _unauthorized_ current-property value — this changes the source of that
   value, not the shape of the query). A lookup for an aggregate that exists
   but belongs to a property the actor is not authorized for returns
   `NOT_FOUND`, not `FORBIDDEN` — this avoids leaking cross-property existence
   (task requirement: "no unauthorized cross-property existence leakage").

## 7. Domain scoping (ORIG-F-004, ORIG-F-005)

Catalog, booking, inventory, maintenance, housekeeping, pricing, coupons,
departments/memberships, and reporting are **already** column-scoped by
`property_id` in the schema (section 1). The only change these domains need is
consuming the authorized `resolvePropertyContext()` result instead of the
unauthorized "first active property," which is the single change described in
sections 5-6, applied per call site enumerated in the research pass (six
`catalog.service.ts` sites, four `coupon.service.ts` sites, five
`rate-plan.service.ts` sites, ten `pricing-policy.service.ts` sites, four
controller-level `PropertyContextService` sites, and the
`PaymentProviderSettingsService` private resolver). `admin_departments`
remain global per `04_RBAC_MATRIX.md` ("department membership alone is not a
permission grant" and no source evidence department scope was ever meant to
be per-property); reporting (`AdminOperationalReportController`) is scoped
through the same resolver used by booking/payment controllers.

## 8. CUSTOMER / GUEST / worker / payment-callback boundaries (unchanged)

Per the task's adversarial-test list and confirmed by source:

- CUSTOMER authorization remains booking/customer ownership
  (`customer-bookings.controller.ts`, actor `userId` scope) — no property
  membership concept applies to customers.
- GUEST authorization remains booking-scoped guest session
  (`guest-access-otp.controller.ts`) — unchanged.
- Payment callback/webhook handlers derive property from the authoritative
  `payments`/`bookings` row they are settling (`momo-webhook.controller.ts`,
  `vnpay-webhook.controller.ts`) — unchanged, no admin actor is involved.
- Worker jobs derive property from the authoritative row they lock (section 1)
  — unchanged, confirmed no `PropertyContextService` usage in
  `apps/worker/src`.

## 9. Cache keys (ORIG-F-004/F-005, no-op)

No existing cache key needs a property component (section 1 — the only cache
is content-hash keyed, not property-scoped). No change.

## 10. Test plan (TDD, adversarial-first)

New: `apps/api/test/integration/property-authorization.integration.test.ts` —
exercises `resolvePropertyContext` against a guarded PostgreSQL database with
two `ACTIVE` properties (A, B) and three admin fixtures: `memberA`
(property-A-only `ROOM_STATUS_VIEWER`-profile membership），`memberAB`
(property-A-and-B membership), `superAdmin` (`SUPER_ADMIN`, no
`admin_property_memberships` row, `'ALL'`), plus a `zeroPropertyAdmin` (active
`admin_memberships` row but no `admin_property_memberships` row at all).
Cases (mirrors the task's adversarial list exactly):

1. memberA read A -> allowed.
2. memberA mutate A (where permission allows) -> allowed.
3. memberA read B -> denied (`PROPERTY_ACCESS_DENIED`).
4. memberA mutate B -> denied.
5. memberA list bookings -> only A's rows returned.
6. memberA aggregate report -> only A's numbers.
7. memberA supplies B's UUID as `requestedPropertyId` -> denied (hostile
   substitution).
8. memberAB explicit A -> allowed; explicit B -> allowed.
9. memberA with no explicit selector -> resolves A safely (single-property
   actor, no context ambiguity).
10. memberAB with no explicit selector -> `PROPERTY_CONTEXT_REQUIRED` (never
    silently first-active).
11. zeroPropertyAdmin -> `PROPERTY_ACCESS_DENIED` for every property-scoped
    route.
12. superAdmin -> allowed for A and B without any membership row.
13. Existence-leakage check: memberA requests a real booking id that belongs
    to property B -> `404 NOT_FOUND`, not `403`.

Existing `apps/api/test/integration/property-authority.integration.test.ts`
(active-property-selection parity) is retained and extended, not replaced —
it already proves "the newer active property wins over an older inactive
one," which remains true for the _candidate set_ step of the algorithm.

Migration tests: `packages/database/test/integration/` gains a fresh-migration

- upgrade-migration test for `0034`, a `properties`/`rooms` count assertion
  (23 preserved), and existing-booking/pricing/housekeeping/access-credential
  row-count preservation assertions (no destructive DDL in 0034 — additive
  table only, so these are regression guards, not expected-to-fail probes).

## 11. Rollout / rollback

`0034` is purely additive (`CREATE TABLE` + backfill `INSERT`s). Rollback is a
new forward migration that drops the table if ever needed post-merge; no
existing table is altered, so no `DB_MIGRATION_POLICY.md` "released migration
immutability" conflict exists. The backfill INSERT is idempotent
(`ON CONFLICT DO NOTHING` against the unique index) matching migration 0028's
existing DO-block pattern (`0028_admin_v2_membership_bootstrap.sql`).

## 12. Explicit non-goals for this phase

- No production data is touched; no property is created/deleted in
  production; B0 public multi-night/multi-property exposure remains disabled
  (unchanged flags).
- Public/customer availability, quote, and booking surfaces remain
  single-active-property (B0 boundary preserved per
  `07_MULTI_PROPERTY_SPEC.md`).
- No new top-level role is added; `OPERATIONS_MANAGER`/`HOUSEKEEPING_MANAGER`/
  etc. `PROPOSED` profiles from `04_RBAC_MATRIX.md` remain future work — this
  phase only adds the property dimension orthogonal to whatever profile a
  membership already grants.
