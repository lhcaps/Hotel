# Phase 8I Endpoint Reconciliation

Date: 2026-07-29
Evidence: `pnpm check:endpoints`, `pnpm check:openapi`, and `docs/audit/phase-8d/endpoint-inventory.csv` regenerated from final route decorators.

## Exact classification

| Classification              | Count | Authority                                                                                             |
| --------------------------- | ----: | ----------------------------------------------------------------------------------------------------- |
| DOCUMENTED                  |    74 | `docs/openapi/admin-v1.json`, `public-v1.json`, and `operations-v1.json`                              |
| EXPLICIT_ALLOWLISTED        |     4 | Better Auth `GET/POST /api/auth/*`; internal `GET /api/v1/health/live` and `GET /api/v1/health/ready` |
| FRAMEWORK_INTERNAL          |     0 | No controller route is classified as framework-only.                                                  |
| DEAD_OR_ORPHANED            |     0 | Every scanned controller decorator maps to exactly one of the categories above.                       |
| UNCLASSIFIED_RUNTIME_ROUTES |     0 | Checker rejects this condition.                                                                       |

`RUNTIME_ROUTE_COUNT=78` and `78 = 74 + 4 + 0 + 0`.

## Corrected checker defect

The prior 79-route claim was not a product route: the decorator regular expression also matched the explanatory `// @Get('*')` comment in `apps/api/src/auth/auth.controller.ts`. The independent regression test `scripts/endpoint-inventory.test.ts` now proves comments are removed before decorator extraction. No route was added to the allowlist and no OpenAPI operation was hidden.

## OpenAPI result

`pnpm check:openapi` validates the generated references and reports 39 ADMIN operations and 19 public operations. The API document count is a document-family count, not an alternative runtime-route denominator; runtime reconciliation is the 78-route table above.
