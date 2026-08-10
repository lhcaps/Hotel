# Master execution plan

## Critical path

`W2 customer edge -> W3 payment/email authority -> W4 lifecycle integrity ->
W5 access/housekeeping -> W6 catalog/property/pricing -> W7 operations -> W8
UX -> W9 golden E2E -> W10 candidate assembly`.

## Wave order

1. **W2:** resolve customer-edge defects, including `FAIL-CI-E2E-001`, with
   component/API/browser evidence and no timeout/retry workaround.
2. **W3:** verify/fix payment callback, reconciliation, SMTP/outbox authority.
3. **W4:** prove booking lifecycle, continuous stay, concurrency, database-time
   and inventory correctness.
4. **W5:** add the required access credential and final-turnover housekeeping
   lifecycle as separate, backward-compatible foundations.
5. **W6:** apply catalog simplification, property authorization, and pricing
   optimizer closure on those foundations.
6. **W7:** operational readiness, safe observability and isolated recovery.
7. **W8:** desktop/mobile/a11y/UX closure.
8. **W9:** canonical non-shortcut browser golden E2E and full acceptance matrix.
9. **W10:** local/hosted all-green proof and release-candidate/reconciliation/
   canary plans, without production mutation.

## Parallelism

Documentation and isolated test-matrix work may run alongside a wave. Domain
schema -> API/worker -> UI -> E2E is sequential. Property authority precedes
any new cross-property operations or pricing scope. Access and housekeeping
must use one continuous booking allocation; no workstream may create an
alternative per-night booking or room-stitching model.
