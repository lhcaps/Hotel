# PEACENEST final system audit

Audit date: 2026-08-06, Asia/Bangkok

Scope: current repository, local PostgreSQL-backed verification, browser evidence, and read-only production evidence for https://peacenest.vn.

## Release and operating baseline

| Item                          | Evidence                                                                           | Verdict      |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------------ |
| Repository HEAD               | 41c915c67caa211db44e419a9cc40c62cd8f6764                                           | PASS         |
| Required production SHA       | Remote current symlink resolves to the required SHA                                | PASS         |
| Rollback reference            | 93d55752b6948572a0fd1c8abe97912514862b71 recorded as the requested rollback target | NOT_EXECUTED |
| Production services           | Caddy, web, API, worker, payment demo, PostgreSQL, and Redis were running          | PASS         |
| Production liveness/readiness | Public health, API live, and API ready endpoints returned 200                      | PASS         |
| Production restart/OOM state  | All inspected containers had restart count 0 and OOMKilled false                   | PASS         |
| Public listeners              | Only ports 80 and 443 were publicly listening in the application host check        | PASS         |
| Source changes                | None made by this audit                                                            | PASS         |

## Verification outcome

| Layer                                    | Result           | Boundary                                                                                                                                                                                                   |
| ---------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governing documents and source inventory | PASS             | All required governing documents were read; runtime route inventory reports 105 runtime routes, 101 documented, and 4 explicitly allowlisted                                                               |
| Static checks                            | PASS             | Endpoints, features, i18n-critical, OpenAPI, lint, typecheck, build, and database schema checks passed                                                                                                     |
| Formatting                               | PARTIAL          | Prettier is blocked by pre-existing untracked docs/integration files; those files were not changed                                                                                                         |
| Unit tests                               | PASS             | Forced-cache-independent unit run passed                                                                                                                                                                   |
| PostgreSQL integration                   | FAIL             | 175/176 passed; coupon concurrent E3 is a test-ordering defect                                                                                                                                             |
| API catalog integration                  | FAIL             | 146/158 passed; 12 failures trace to stale/missing fixture data                                                                                                                                            |
| Browser E2E                              | PARTIAL          | 160/161 passed; one reversed-date case races page hydration                                                                                                                                                |
| Production public boundary               | PASS             | Public catalog, availability, nearby availability, and invalid offers checks returned sanitized responses with zero forbidden-field matches                                                                |
| Production anonymous boundary            | PASS             | Protected API reads returned 401 without a session                                                                                                                                                         |
| Production ROOM_STATUS_VIEWER boundary   | PARTIAL          | Login, identity, allowed reads, restricted reads, mutation denial, redirect behavior, payload minimization, and logout passed; navigation/read scope includes extra property/room/maintenance surfaces     |
| External providers                       | BLOCKED_EXTERNAL | Google live login, live SMTP, MoMo sandbox, VNPAY sandbox, and public callback acceptance were not executed because the required external prerequisites were not available or were explicitly out of scope |

## Closure decision

The current release is operationally live and the core public projection is safe, but the final system is not functionally closed. Open P2 findings remain in production viewer scope and in the local verification fixtures/readiness race. The system is not ready for Operations V3 design review until these findings are resolved and reverified.

No production mutation, direct production DDL, room inventory import, payment, deployment, commit, push, branch, reset, stash, rebase, amend, or cleanup of pre-existing QA credentials was performed.
