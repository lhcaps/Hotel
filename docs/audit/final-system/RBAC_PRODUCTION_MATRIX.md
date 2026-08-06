# Production RBAC matrix

Evidence date: 2026-08-06. All production checks were read-only except the supported viewer login/logout flow using a pre-existing QA credential. No credential, cookie, token, raw email, or personal data is recorded here.

## Anonymous boundary

| Request class                                  |                        Observed result | Verdict |
| ---------------------------------------------- | -------------------------------------: | ------- |
| /api/v1/admin/me                               |                                    401 | PASS    |
| Protected admin API reads                      |                  401 without a session | PASS    |
| /api/v1/customer/profile and customer bookings |                  401 without a session | PASS    |
| Public catalog and availability routes         | 200/201 according to endpoint response | PASS    |

## SUPER_ADMIN

| Check               | Observed result                                                      | Verdict |
| ------------------- | -------------------------------------------------------------------- | ------- |
| /api/v1/admin/me    | 200; role SUPER_ADMIN; 63 permissions                                | PASS    |
| Admin bookings page | Accessible in operator-controlled browser session                    | PASS    |
| Identity disclosure | Only masked identity fields were inspected; no raw identity recorded | PASS    |

This is a bounded identity/read check. It is not a claim that every production mutation was exercised; production CRUD/payment mutations were intentionally not executed.

## ROOM_STATUS_VIEWER

| Boundary                                                                                           | Observed result                                                                                 | Verdict                                                                |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Supported login                                                                                    | Sign-in response 200; redirected to /admin/room-operations                                      | PASS                                                                   |
| Server identity                                                                                    | /api/v1/admin/me returned ROOM_STATUS_VIEWER with 7 permissions                                 | PASS                                                                   |
| Room operations read                                                                               | Allowed                                                                                         | PASS                                                                   |
| Rooms read                                                                                         | Allowed                                                                                         | PASS                                                                   |
| Maintenance blocks read                                                                            | Allowed                                                                                         | PASS                                                                   |
| Property read                                                                                      | Allowed in current production implementation                                                    | FAIL against the stated viewer boundary                                |
| Booking, payment, review, pricing, provider, accounts, customer accounts, departments, audit reads | 403                                                                                             | PASS                                                                   |
| Viewer mutation probe                                                                              | 403                                                                                             | PASS                                                                   |
| Direct restricted page navigation                                                                  | Controlled redirect back to /admin/room-operations                                              | PASS for redirect containment                                          |
| Viewer payload forbidden fields                                                                    | Zero matches for customer identity, payment, revenue, provider, audit, or raw-credential fields | PASS                                                                   |
| Navigation links                                                                                   | Included /admin/room-operations, /admin/rooms, /admin/maintenance, and /admin/property          | FAIL against the stated “room-operation surface/profile only” boundary |
| Profile and logout                                                                                 | Profile available; logout returned to /admin/login; post-logout /api/v1/admin/me returned 401   | PASS                                                                   |

The current source grants catalog.property.read, catalog.room.read, and catalog.maintenance.read to ROOM_STATUS_VIEWER, and the admin navigation renders links based on those permissions. This explains the live scope. The production payload is minimized, but the authorization/UI contract is not closed.

## CUSTOMER

Live Google customer login and production customer-session flow were not completed because the external OAuth prerequisite was not available for this audit. Verdict: BLOCKED_EXTERNAL, not PASS.
