# ADMIN V2 page acceptance matrix

Every row requires fresh focused tests, browser interaction, and screenshots at `390×844`, `768×1024`, `1024×768`, `1280×800`, `1440×900`, and `1920×1080`. A build or aggregate E2E pass alone is insufficient.

| Page                    | SUPER_ADMIN              | ROOM_STATUS_VIEWER              | Data boundary                     | Key acceptance                                     |
| ----------------------- | ------------------------ | ------------------------------- | --------------------------------- | -------------------------------------------------- |
| Tổng quan               | read                     | redirect/room-only summary      | financial aggregates server-gated | five metrics max, queues first, honest stale/error |
| Đặt phòng               | read/manage lifecycle    | denied                          | booking/customer/payment PII      | filters, valid pagination, detail sheet            |
| Chi tiết đặt phòng      | read/manage lifecycle    | denied                          | contact and amount ADMIN-only     | authoritative actions and audit timeline           |
| Quét mã                 | read/manage check-in/out | denied                          | booking preview sensitive         | camera/manual/error/eligibility states             |
| Đối soát thanh toán     | read/reconcile           | denied                          | no provider secrets/signatures    | attempts/timeline/review state                     |
| Chi tiết thanh toán     | read/reconcile           | denied                          | no raw provider payload           | safe detail sheet and action guard                 |
| Vận hành đánh giá       | read/manage review       | denied                          | sanitized customer/review content | tabs, moderation state, valid pagination           |
| Tình trạng phòng        | read/manage operations   | read-only                       | viewer-safe room data only        | grouped scan-first table, no mutation              |
| Phòng                   | read/manage              | denied                          | physical room ADMIN-only          | natural sort, inactive archive isolation           |
| Bảo trì                 | read/manage              | read-only as needed             | interval/reason safe              | overlap validation, states                         |
| Loại phòng              | read/manage              | denied                          | nine concepts, not physical rooms | structured sheet sections                          |
| Tiện nghi               | read/manage              | denied                          | catalog                           | compact dialog, error/empty                        |
| Cơ sở                   | read/manage              | denied unless explicitly needed | no env/secrets                    | structured settings                                |
| Hạng giá                | read/manage              | denied                          | price tiers                       | display order and counts                           |
| Gói giá                 | read/manage              | denied                          | pricing rules                     | structured sections and ambiguity validation       |
| Mã ưu đãi               | read/manage              | denied                          | coupon pricing/limits             | guided sheet, duplicate/date validation            |
| Nhà cung cấp thanh toán | read/manage              | denied                          | sanitized readiness only          | no credentials/signatures, all Vietnamese          |
| Tài khoản               | read/manage              | denied                          | masked accounts/sessions          | tabs, no password/token, lock/revoke audit         |
| Phòng ban và quyền hạn  | read/manage              | denied                          | two fixed profiles                | profile templates and member assignment            |
| Nhật ký quản trị        | read                     | denied                          | sanitized audit only              | filters and correlation IDs                        |
| Hồ sơ quản trị          | own session scope        | own session scope               | no customer loader/tokens         | label, department, permissions summary, logout     |
