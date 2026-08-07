# Multi-property boundary

## Current fact

Property-owned tables and composite foreign keys are present, but public and administrative context still resolves the first active property. `PropertyContextService.getCurrent()` orders active properties by `createdAt` (`apps/api/src/catalog/property-context.service.ts:18-35`). Pricing availability, quote, nearby availability, catalog, coupons, payment settings, and admin operations have similar `getCurrent`/first-active paths. The local database has two active properties, but that observation is `LOCAL_DEVELOPMENT_EVIDENCE_ONLY`.

## Target boundary

Every request, cache key, job, provider setting, audit event, quote, booking, payment, access entitlement, room, maintenance block, and housekeeping task must have one server-authorized property context. A customer may browse a public property only through an allowed catalog projection; arbitrary internal property ids are not accepted as authority. A booking may not span properties.

## B0 boundary

B0 remains single-current-property compatible but must avoid adding a new client-selected property shortcut. All new interval/pricing/quote data must carry or derive the same property timezone and property id already used by availability, quote, HOLD, and booking. Do not enable property creation or multi-property production exposure in B0.

## Later migration/authorization work

Before multi-property rollout, audit every current-property query and replace it with explicit authorized context. Add property membership/scope only if the existing admin membership model cannot express it; do not infer property scope from department name. Validate composite foreign keys, unique indexes, payment-provider settings, worker selection, audit property ids, and cache isolation. Cross-property booking, room movement, and shared inventory are rejected by default.
