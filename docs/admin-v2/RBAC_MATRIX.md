# ADMIN V2 RBAC matrix

## Profiles

| Profile              | Vietnamese label         | Scope                                                                                                                               |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SUPER_ADMIN`        | Tổng quản trị            | All typed ADMIN permissions and all ADMIN V2 pages/mutations                                                                        |
| `ROOM_STATUS_VIEWER` | Nhân viên theo dõi phòng | `rooms.read`, `room_operations.read`, and the minimum maintenance read needed to explain room state; no mutations or sensitive data |

Top-level roles remain `CUSTOMER`, `ADMIN`, and `SYSTEM_WORKER`. Legacy `ADMIN` users without an active membership are assignment-required/fail-closed; they are not silently granted the SUPER_ADMIN profile.

## Typed permission contract

`dashboard.read`; `bookings.read`, `bookings.manage`, `bookings.checkin`, `bookings.checkout`, `bookings.cancel`; `customers.read`, `customers.manage`, `customers.sessions.revoke`; `rooms.read`, `rooms.manage`; `room_operations.read`, `room_operations.manage`; `maintenance.read`, `maintenance.manage`; `payments.read`, `payments.reconcile`, `payments.refund`; `reviews.read`, `reviews.manage`; `catalog.read`, `catalog.manage`, `amenities.manage`; `pricing.read`, `pricing.manage`, `coupons.manage`; `providers.read`, `providers.manage`; `admin_accounts.read`, `admin_accounts.manage`; `departments.read`, `departments.manage`; `audit.read`; `property.read`, `property.manage`.

Existing controller permission identifiers remain compatibility aliases during the migration (`catalog.*`, `booking.*`, `payment.*`, `admin.*`, `pricing.*`, `coupon.*`). The server policy maps them to the two fixed profiles; the browser never becomes an authorization authority.

## Request outcomes

| Caller                                             | Protected ADMIN API |                            Mutation |
| -------------------------------------------------- | ------------------: | ----------------------------------: |
| anonymous/expired                                  |                 401 |                                 401 |
| authenticated CUSTOMER                             |                 403 |                                 403 |
| disabled account                                   |                 403 |                                 403 |
| legacy ADMIN without active membership             |                 403 |                                 403 |
| ROOM_STATUS_VIEWER, room read                      |                 200 |                                 n/a |
| ROOM_STATUS_VIEWER, sensitive read or any mutation |                 403 |                                 403 |
| SUPER_ADMIN                                        |                 200 | 2xx when domain validation succeeds |

## Data minimization

ROOM_STATUS_VIEWER may receive only room code/number, concept, tier, floor, operational/housekeeping/maintenance state, current occupancy window, next booking time, and last-updated metadata. It must not receive customer identity, email, phone, booking amount, payment state, revenue, cancellation amount, audit identity, provider configuration, or raw credentials.

## Escalation defenses

- Required permissions are read from Nest metadata and enforced by `AdminPermissionGuard`.
- Profile assignment is server-side and transactionally audited.
- Client-supplied role/profile fields are validated but do not create authority.
- A user cannot grant or elevate their own profile through the account API.
- Revoked/expired sessions and disabled memberships are rejected on every request.
