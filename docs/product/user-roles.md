# Vai tro nguoi dung va ranh gioi phan quyen

**Trang thai:** Final - Phase 0  
**Nguon:** S-002, S-003

## Nguyen tac

Authentication xac dinh chu the; authorization xac dinh hanh dong tren tai nguyen. UI an/hien khong phai security boundary. Moi quyen nhay cam MUST duoc kiem tra server-side va ghi audit event theo `INV-021`, `INV-022`, `INV-025`.

## Tac nhan

| Tac nhan | Xac thuc | Pham vi du lieu | Hanh dong duoc phep | Hanh dong cam / nhay cam |
|---|---|---|---|---|
| Guest visitor | Khong can login | Noi dung cong khai, availability, quote | Browse, search, quote, tao HOLD, thanh toan | Khong doc booking bang code don le; khong quan tri |
| Guest customer | Booking code + email OTP | Dung booking da xac minh | Xem booking, nhan thong bao | Khong doi gia, coupon, phong, state |
| CUSTOMER | Google OIDC hoac email/password | Ho so va booking so huu | Quan ly ho so, tao booking, thanh toan, xem booking | Khong quan tri; khong doc booking cua nguoi khac |
| ADMIN | Tai khoan staff xac thuc manh | Toan bo du lieu property | Quan ly phong/gia/coupon, xu ly booking, check-in/out, cancellation, reconciliation, doc audit | Khong sua/xoa audit log; khong tu xac nhan payment khong co verified evidence |
| SYSTEM_WORKER | Workload identity noi bo | Queue/outbox duoc phan cong | Expire HOLD, gui email, retry outbox, tao reconciliation work | Khong interactive login; khong tu y doi gia hay bo qua guards |
| Google Identity Provider | OAuth/OIDC | Identity claims duoc consent | Xac thuc Google login | Khong la authority cho booking ownership sau khi session ket thuc |
| MoMo / VNPAY | HTTPS webhook/IPN + signature | Provider transaction event | Bao ket qua payment | Return URL khong co quyen doi booking |
| Email / Translation provider | Service credential toi thieu | Payload can thiet | Gui email; dich public content | Translation provider MUST NOT nhan PII |

## Permission matrix

| Capability | Guest | CUSTOMER | ADMIN | SYSTEM_WORKER |
|---|:---:|:---:|:---:|:---:|
| Search availability va receive quote | Yes | Yes | Yes | No |
| Create HOLD / payment attempt | Yes | Yes | Yes, ho tro van hanh | No |
| View owned or OTP-verified booking | Yes, OTP | Yes | Yes | No |
| Manage profile | No | Yes | No | No |
| Manage room type, physical room, maintenance | No | No | Yes | No |
| Manage price tier, rate plan, coupon | No | No | Yes | No |
| Check-in, check-out, no-show, cancellation | No | No | Yes | No |
| Process expired HOLD / email / reconciliation job | No | No | View only | Yes |
| View audit log | No | Own events only where exposed | Yes | Write append-only events |

## Session, privacy va separation of duty

- CUSTOMER session MUST bind server-side identity; guest lookup MUST require OTP proof for email supplied with booking.
- Google login chi co the prefill name, email va profile image khi co; phone do customer tu nhap va xac nhan trong booking.
- ADMIN session SHOULD yeu cau MFA truoc production. Cac hanh dong gia, coupon, cancellation, room reassignment, check-in/out va reconciliation MUST tao audit event co actor, thoi diem, before/after va ly do khi co.
- SYSTEM_WORKER chi nhan scoped credentials; queue message khong tu dong mang quyen ADMIN.
- ADMIN huy booking da thanh toan tao manual operational review; refund khong tu dong trong MVP. Dieu nay tao separation of duty giua booking cancellation va quyet dinh hoan tien.

## Yeu cau bao mat role

- `SEC-001`: moi authorization decision duoc thuc thi o API, khong dua vao route hay menu.
- `SEC-002`: booking ownership kiem tra theo account ownership hoac guest OTP, chong IDOR.
- `SEC-003`: login, OTP, reset password, booking lookup va admin endpoints MUST rate-limit va ghi detection event.
- `SEC-004`: token, password, OAuth credential va payment secret MUST NOT vao log.
