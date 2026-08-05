# Current ADMIN UI audit

Evidence source: current HEAD `7203905d09ab49bfa06a35e99e57510d9fa5b7f2`, App Router source, API controllers, contracts, and the fixed production baseline. This is a source/runtime audit, not a claim that all viewport/browser states are already accepted.

## Cross-cutting defects confirmed

- The protected shell uses a permanent `Sidebar` and does not convert it to a mobile `Sheet`.
- `AdminNavigation` contains a client-side `requiredPermissionByPath` map and a role-specific branch; it is not a complete server-capability-generated navigation contract.
- `AdminMe` contains role and permission arrays but not profile label, department object, or account status.
- Several pages still use raw HTML forms, selects, buttons, tables, and inline creation/edit walls instead of the installed Base UI primitives.
- Operational/provider/account surfaces contain English strings and raw enum values (`ADMIN`, `ACTIVE`, `AVAILABLE`, `Configured`, `Save settings`, etc.).
- Fetch failures are represented as generic error text or absent content; existing pages lack a shared stale/last-known-good/retry state.
- Pagination and detail behavior vary by page; the acceptance requirement is valid page/total page with no `NaN`.
- Room operations currently returns a sanitized viewer response, but the UI is a list, does not group operational queues, and does not expose the required physical room/tier/floor fields.
- `/admin/accounts` and `/admin/customer-accounts` split the account workflow rather than using one tabbed workspace.
- Audit currently displays raw `eventType`, actor UUID, and JSON payload directly.

## Page-by-page acceptance starting point

| Page                    | Primary staff task                      | Allowed profile                 | Current loading/empty/error/permission state                      | Responsive/a11y risk                        | PII/secret risk                                |
| ----------------------- | --------------------------------------- | ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Tổng quan               | Scan queues and period metrics          | SUPER_ADMIN                     | report has loading/error; no shared stale/partial state           | raw filter wall and dense tables            | financial data must never reach viewer         |
| Đặt phòng               | filter and act on bookings              | SUPER_ADMIN                     | page has basic loading/error/empty; no detail sheet               | cramped table and row actions               | customer snapshot/amount must be server-gated  |
| Chi tiết đặt phòng      | inspect lifecycle and act               | SUPER_ADMIN                     | page-level fetch/error; actions are page forms                    | long page on mobile                         | booking contact and amount denied to viewer    |
| Quét mã                 | scan/confirm check-in/out               | SUPER_ADMIN                     | scanner component has several states but needs full explicit copy | camera/keyboard behavior unverified         | booking preview is sensitive                   |
| Đối soát thanh toán     | identify and reconcile exceptions       | SUPER_ADMIN                     | basic loading/error; raw status                                   | table/detail responsiveness                 | provider payload/signature must stay hidden    |
| Chi tiết thanh toán     | inspect attempts/timeline               | SUPER_ADMIN                     | basic loading/error                                               | wide timeline/table                         | payment/customer data sensitive                |
| Vận hành đánh giá       | resolve operational reviews             | SUPER_ADMIN                     | open/resolved filters only                                        | raw table/form                              | review content/customer data sensitive         |
| Tình trạng phòng        | scan room state                         | SUPER_ADMIN, ROOM_STATUS_VIEWER | basic date/refresh/error; no stale data preservation              | list does not preserve comparison semantics | viewer must never see customer/payment fields  |
| Phòng                   | manage active physical inventory        | SUPER_ADMIN                     | manager-specific states                                           | mixed table/list/form                       | physical code is ADMIN-only                    |
| Bảo trì                 | schedule and release maintenance blocks | SUPER_ADMIN                     | manager-specific states                                           | interval form/table                         | reason may be operationally sensitive          |
| Loại phòng              | manage nine room concepts               | SUPER_ADMIN                     | manager-specific states                                           | long form, no media sections                | public-safe content only                       |
| Tiện nghi               | maintain amenity catalog                | SUPER_ADMIN                     | manager-specific states                                           | inline editing                              | low risk                                       |
| Cơ sở                   | edit property policies                  | SUPER_ADMIN                     | manager-specific states                                           | settings form                               | environment/secrets must not appear            |
| Hạng giá                | maintain price tiers                    | SUPER_ADMIN                     | manager-specific states                                           | inline operations                           | pricing is sensitive                           |
| Gói giá                 | validate rate rules and prices          | SUPER_ADMIN                     | manager-specific states                                           | long form and raw identifiers               | pricing is sensitive                           |
| Mã ưu đãi               | create and govern coupons               | SUPER_ADMIN                     | basic list/form states                                            | card list and long form                     | pricing/usage data sensitive                   |
| Nhà cung cấp thanh toán | inspect sanitized readiness             | SUPER_ADMIN                     | English loading/errors                                            | forms not compact on mobile                 | credentials/signatures must never render       |
| Tài khoản               | manage customer/admin accounts          | SUPER_ADMIN                     | basic list/form states                                            | duplicate routes and raw form               | OAuth/session/password secrets must not render |
| Phòng ban và quyền hạn  | assign the two fixed profiles           | SUPER_ADMIN                     | basic list/form states                                            | no profile detail                           | privilege escalation risk                      |
| Nhật ký quản trị        | investigate sanitized actions           | SUPER_ADMIN                     | basic loading/error                                               | raw JSON table                              | audit payload must be scrubbed                 |
| Hồ sơ quản trị          | inspect own effective scope             | SUPER_ADMIN, ROOM_STATUS_VIEWER | basic loading/error                                               | no mobile shell contract                    | customer profile boundary must hold            |

## Required viewport audit set

`390×844`, `768×1024`, `1024×768`, `1280×800`, `1440×900`, `1920×1080`. Each page must capture desktop/tablet/mobile evidence after the implementation loop; source inspection alone is not a PASS.
