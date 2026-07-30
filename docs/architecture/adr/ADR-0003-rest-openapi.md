# ADR-0003 - REST va OpenAPI la API contract

**Status:** Accepted  
**Date:** 2026-07-21  
**Decision owners:** Product owner, Solution Architect

## Context

Client site, Admin site, worker, payment webhooks va future integration can contract ro, on dinh va doc lap voi UI implementation.

## Decision

Dung REST qua HTTPS lam primary API contract va mo ta bang OpenAPI. Tach logical public/customer, administrative va payment webhook boundaries. Versioning o muc prefix/compatibility policy khi co breaking change; payload payment signature khong duoc expose trong public docs.

## Decision drivers

Compatibility voi browser, provider webhook, tooling OpenAPI, observability va testing contract.

## Considered alternatives

- tRPC-only: tu chon lam primary contract vi webhook/external integration va public contract khong phu hop transport type-coupled.
- GraphQL-only: tu chon vi MVP khong can flexible query graph va can don gian webhook/security surface.

## Consequences

### Positive consequences

Contract testable, client/Admin tach boundary, provider adapter co endpoint ro, de document error va idempotency semantics.

### Negative consequences

Can governance version, deprecation va OpenAPI maintenance.

## Risks

Overexposure admin endpoints, IDOR va contract drift. Giam thieu bang authz middleware server-side, schema validation, OpenAPI review va security tests.

## Constraints

Khong dinh nghia endpoint list hay controller implementation trong Phase 0. Return URL khong phai API authority cho payment.

## Revisit conditions

Danh gia additional query protocol khi co measured client use case ma REST khong dap ung ma khong lam yeu external API contract.

## Related documents

[User roles](../../product/user-roles.md), [Payment state machine](../../domain/booking-state-machine.md), [Threat model](../../security/threat-model.md).
