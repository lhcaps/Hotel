# Business invariants

**Trang thai:** Final - Phase 0. Cac invariant nay la quy tac bat buoc cho database design, API, worker va test o Phase sau.

## Inventory va thoi gian

| ID | Invariant | Test implication |
|---|---|---|
| INV-001 | Mot physical room khong co hai booking overlap trong HOLD, CONFIRMED, CHECKED_IN. | Concurrency create HOLD chi mot allocation thanh cong. |
| INV-002 | Booking interval dung `[checkIn, checkOut)`. | End cua booking A bang start cua B la hop le. |
| INV-003 | Khach chon room type; server cap physical room transactionally khi HOLD. | Client khong the ep room number. |
| INV-004 | Quote va HOLD het han sau 15 phut. | Worker expiry an toan voi webhook race. |
| INV-030 | Physical room maintenance khong duoc cap vao booking. | Availability loai maintenance block. |

## Pricing va occupancy

| ID | Invariant | Test implication |
|---|---|---|
| INV-005 | Final price chi tinh/xac nhan o server. | Client amount sai khong doi quote. |
| INV-006 | Moi booking luu immutable price snapshot. | Gia rule doi khong doi booking confirmed. |
| INV-007 | Client-submitted amount khong trustworthy. | Amount mismatch bi tu choi/review. |
| INV-008 | Gia cau hinh theo room type/tier/combo, khong hard-code app. | Thay tier amount khong sua source. |
| INV-009 | Rule thoi gian dac thu co priority cao hon duration chung. | Lunch/Night/Day override dung. |
| INV-010 | Extra hour lam tron len theo block 60 phut. | Excess 1 phut bang 1 extra unit. |
| INV-028 | Tien dung integer VND, khong floating-point. | Khong co sai so decimal. |
| INV-029 | Price snapshot lich su khong bi thay doi boi catalog moi. | Reprice chi tao quote moi. |
| INV-034 | Phase 8B: moi quote moi phai tra ve candidate co gross thap nhat (chinh sach `CHEAPEST_ELIGIBLE_THEN_PRIORITY`). | 18 exact-time cases + exhaustive oracle match trong audit-phase8b. |
| INV-035 | Phase 8B: advisory recommendation khong duoc dat phong, giu coupon quota, tao HOLD hoac quote persistent. | 15 recommendation cases; response bao gom `advisoryExpiresAt`. |

## Booking va payment

| ID | Invariant | Test implication |
|---|---|---|
| INV-011 | Booking va payment co state machine doc lap. | Failed attempt khong doi booking thanh payment-failed. |
| INV-012 | Return URL khong phai payment evidence. | Redirect khong confirm booking. |
| INV-013 | Chi verified signature, merchant, order va amount duoc CONFIRM booking. | Forged/mismatched webhook bi tu choi. |
| INV-014 | Webhook lap lai khong lap business effect. | Mot confirm, coupon redeem, email. |
| INV-015 | Payment success sau HOLD expiry phai REVIEW_REQUIRED, khong auto-confirm. | Late webhook khong cap room. |
| INV-016 | Redis khong la source of truth cho inventory, booking, coupon, payment. | Redis loss khong mat state nghiep vu. |

## Coupon

| ID | Invariant | Test implication |
|---|---|---|
| INV-017 | Coupon duoc revalidate server-side trong transaction. | Quote cu khong bypass limit. |
| INV-018 | Coupon co limit phai reserve trong HOLD. | Quota cuoi khong oversell. |
| INV-019 | Coupon redeem khi payment verified. | Failure khong consume coupon. |
| INV-020 | Coupon release khi HOLD expiry/cancel truoc confirmation. | Quota tro lai chinh xac. |

## Authorization, audit va privacy

| ID | Invariant | Test implication |
|---|---|---|
| INV-021 | Admin permission kiem tra server-side. | Direct API call khong bypass role. |
| INV-022 | UI hide/show khong la security boundary. | Hidden action van bi API deny. |
| INV-023 | Guest xem booking chi sau email OTP. | Booking code don le bi deny. |
| INV-024 | Google login khong mac dinh co phone. | Booking bat phone tu user input. |
| INV-025 | Moi booking state change tao audit event append-only. | Transition matrix co audit record. |
| INV-026 | Password/session/OAuth/payment secrets khong ghi log. | Log redaction test. |
| INV-027 | Translation provider khong nhan customer PII. | Translation payload allow-list public fields. |

## Traceability

Pricing rules `PRC-001..009`, coupon rules `CPN-001..004`, state transitions `STM-001..008`, journeys `JRN-001..010`, threats `THR-001..020`, Phase 8C journeys `JRN-011..JRN-014`, and threats `THR-025..THR-026` phai tham chieu cac invariant lien quan trong implementation test plan.

## Phase 7C payment-core invariants

| ID | Invariant | Test implication |
|---|---|---|
| INV-031 | Payment events deduplicate by provider plus provider event id; raw webhook payloads and secrets are not persisted or logged. | Concurrent duplicate delivery has one business effect. |
| INV-032 | A verified success confirms only an unexpired HOLD with ACTIVE inventory, unreleased coupon reservation, exact VND amount/currency and no transaction conflict. | Late, mismatch, released and conflict cases become REVIEW_REQUIRED. |
| INV-033 | A zero-amount booking is confirmed only through a server-side idempotent no-charge flow, never a fake provider. | Replay does not repeat side effects; nonzero amount is rejected. |

## Phase 8C payment settlement reconciliation invariants

| ID | Invariant | Test implication |
|---|---|---|
| INV-036 | The settlement core (`applyVerifiedPaymentEvent`) is the only path that can transition booking, payment, coupon, inventory, audit, and outbox rows. The reconciliation cycle never short-circuits this path; it feeds the core with a synthetic verified marker or advances only the dedicated `payment_attempts` reconciliation columns. | Reconciliation outcomes either (a) commit through the canonical core or (b) write only to `reconciliation_attempt_count` / `next_reconciliation_at` / `last_reconciled_at` / `last_error_code` / `lease_owner` / `lease_expires_at`. |
| INV-037 | Reconciliation claims a batch of `payment_attempts` rows whose `status = 'PENDING'` and whose `next_reconciliation_at <= now()` with `FOR UPDATE SKIP LOCKED`, using a bounded lease (`lease_owner`, `lease_expires_at`). Lost leases produce a `LEASE_LOST` outcome and retry, never a double-write of `reconciliation_attempt_count`. | Concurrent worker ticks do not corrupt the attempt; the lease is recovered by the next tick. |
| INV-038 | The reconciliation policy is bounded (`maxAttempts 1..32`, `delayMinutes[i] 1..1440`); `validateReconciliationPolicy` rejects out-of-bound values before any database write. | Misconfigured workers fail closed without retry storms. |
| INV-039 | A second provider attempting to settle the same booking cannot produce a second confirmation: `payments_property_booking_uq` plus the settlement lock order (`booking -> payment -> payment_attempt -> inventory_block -> coupon_application`) downgrade the loser to `REVIEW_REQUIRED` with category `CROSS_PROVIDER_TRANSACTION_CONFLICT`. | MoMo-vs-VNPAY race yields exactly one `SUCCEEDED` and one `REVIEW_REQUIRED`. |
| INV-040 | Status-query adapters reuse the same canonical signing (MoMo HMAC-SHA256, VNPAY HMAC-SHA512) as the IPN adapters and use `crypto.timingSafeEqual` for verification; raw query responses, raw webhook bodies, and signatures are never persisted or logged. The Gate B.1 cryptographic-conformance test asserts byte-identical digests between the independent oracles and the production canonical builders. | Gate B.1 conformance gate is green before any reconciliation tick fires. |
