# Wave 0 production truth snapshot

Snapshot time: 2026-08-10, read-only SSH/Docker inspection. No production command changed a container, file, configuration, database, flag, or symlink.

## Executive snapshot

**CONTRADICTED:** production is not under one release authority. `/current` resolves to `/opt/room-management/releases/4fb79a023209c349cff5c74caec626556459ae67`, while the shared environment declares `RELEASE_SHA=41c915c67caa211db44e419a9cc40c62cd8f6764`. API, web, payment-demo, caddy, and postgres are Compose-owned from a staging path; worker is Compose-owned from the `4fb…` release but labels source revision `88ece…`; Redis is owned by an older `9bf…` release.

## Runtime matrix

| Service      | Container ID    | Image ref                                       | Image ID               | Revision label  | Created / started                    | Restarts | Compose ownership | Classification |
| ------------ | --------------- | ----------------------------------------------- | ---------------------- | --------------- | ------------------------------------ | -------: | ----------------- | -------------- |
| api          | `6508376a2cb…`  | `room-management-api`                           | `sha256:de21885aa890…` | `4fb79a023209…` | `2026-08-09T12:00:23Z` / `12:00:23Z` |        0 | staging `4fb…`    | CONTRADICTED   |
| web          | `6dd531f53b19…` | `room-management-web`                           | `sha256:74faf7f2e9ca…` | `4fb79a023209…` | `2026-08-09T00:38:54Z` / `00:39:05Z` |        0 | staging `4fb…`    | CONTRADICTED   |
| worker       | `1b32eb83cc39…` | `room-management-api` (revision in next column) | `sha256:b261642cfa34…` | `88ece32a32fe…` | `2026-08-09T11:46:06Z` / `11:46:16Z` |        0 | release `4fb…`    | CONTRADICTED   |
| payment-demo | `03c03931cb42…` | `room-management-payment-demo`                  | `sha256:c7fca1b70997…` | `4fb79a023209…` | `2026-08-09T11:45:38Z` / `11:45:39Z` |        0 | staging `4fb…`    | CONTRADICTED   |
| caddy        | `891f25fea8cc…` | `caddy:2.10.2-alpine`                           | `sha256:4c6e91c6ed0e…` | absent          | `2026-08-09T11:46:48Z` / `11:46:48Z` |        0 | staging `4fb…`    | PARTIAL        |
| postgres     | `bf5634830811…` | `postgres:18.1-alpine`                          | `sha256:aa6eb304ddb6…` | absent          | `2026-08-09T00:38:54Z` / `00:39:05Z` |        0 | staging `4fb…`    | PARTIAL        |
| redis        | `ddaf94c4f6ca…` | `redis:8.4.0-alpine`                            | `sha256:4eec4565e45a…` | absent          | `2026-08-04T18:46:12Z` / `18:47:02Z` |        0 | release `9bf…`    | CONTRADICTED   |

All listed containers reported `running` and restart count `0` at inspection. The API host-loopback readiness probe returned HTTP `000`; this is **PARTIAL**, not evidence of an API health failure, because the service is not host-loopback reachable in this topology.

## Current pointer and feature gates

**VERIFIED:** pointer is `releases/4fb79a023209c349cff5c74caec626556459ae67`.  
**VERIFIED:** catalog runtime = `true`; internal multi-night = `true`; public multi-night = `true`; B0 production remediation = `false`.  
**CONTRADICTED:** shared `RELEASE_SHA` is `41c915…`, not the release-pointer revision or worker label.

## Risk interpretation

`PRODUCTION_RELEASE_AUTHORITIES=MULTIPLE_CONTRADICTORY`  
`PRODUCTION_MIXED_IMAGE_STATE=VERIFIED`  
`PRODUCTION_POINTER_MATCH=CONTRADICTED`  
`PRODUCTION_COMPOSE_OWNERSHIP_DIVERGENCE=VERIFIED`  
`PRODUCTION_MUTABLE_TAG_USAGE=PARTIAL` (API/web/payment-demo use local names with no immutable digest in the image reference; their image IDs were captured.)  
`PRODUCTION_RELEASE_ATTESTATION=FAIL_EXPECTED_MIXED_STATE`

## Read-only evidence commands

The snapshot used `sudo docker inspect` with only name, immutable image ID, timestamps, restart count, and non-secret labels; `readlink -f /opt/room-management/current`; and a restricted `grep` for five non-secret release/feature keys. No environment values outside those named keys were printed.

`WAVE0_PRODUCTION_TRUTH_STATUS=MIXED_AND_RECONCILIATION_REQUIRED`
