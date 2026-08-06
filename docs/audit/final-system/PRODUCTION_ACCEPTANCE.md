# Production acceptance

Acceptance date: 2026-08-06, Asia/Bangkok

## Release identity

| Check                       | Result                                   |
| --------------------------- | ---------------------------------------- |
| Expected SHA                | 41c915c67caa211db44e419a9cc40c62cd8f6764 |
| Current production release  | Matches expected SHA                     |
| Rollback target             | 93d55752b6948572a0fd1c8abe97912514862b71 |
| Deployment performed        | No                                       |
| Public HTTP/HTTPS listeners | 80, 443                                  |
| Container restart count     | 0 for inspected services                 |
| OOMKilled                   | false for inspected services             |

## Read-only smoke

| Check                            | Result                                                |
| -------------------------------- | ----------------------------------------------------- |
| https://peacenest.vn/            | 200                                                   |
| /health                          | 200                                                   |
| /api/v1/health/live              | 200                                                   |
| /api/v1/health/ready             | 200                                                   |
| /rooms, /admin/login, /login     | 200                                                   |
| Anonymous protected API requests | 401                                                   |
| Public room catalog              | 200; 9 items; zero forbidden-field matches            |
| Public availability              | 201; AVAILABLE; 9 items; zero forbidden-field matches |
| Public nearby availability       | 201; zero forbidden-field matches                     |
| Invalid anonymous offer request  | 400 problem response                                  |

## Role acceptance

SUPER_ADMIN identity/read evidence passed with a server-derived role and 63 permissions. ROOM_STATUS_VIEWER login, seven-permission identity, allowed room/maintenance reads, restricted-read 403s, mutation 403, sanitized payload, redirect containment, profile, and logout passed. The role is still PARTIAL because current UI navigation and property read access exceed the stated final viewer boundary.

## Production verdict

Production runtime and public safety: PASS.

Production functional closure: PARTIAL.

Production mutation acceptance: NOT_SAFE_FOR_PRODUCTION_EXECUTION.

External provider acceptance: BLOCKED_EXTERNAL.
