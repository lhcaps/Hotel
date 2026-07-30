# Pham vi san pham - Nen tang quan ly dat phong

**Trang thai:** Final - Phase 0  
**Ngay:** 2026-07-21  
**Phien ban:** 1.0

## 1. Muc dich va van de

Nen tang cung cap mot vong lap dat phong co kiem soat ton phong va thanh toan cho **mot co so luu tru**: cau hinh phong va gia, tim phong trong, tao `HOLD`, thanh toan toan bo, xac nhan bang webhook/IPN, sau do Admin check-in/check-out. Nen tang phai ngan overbooking, khong tin gia tu trinh duyet va de lai dau vet kiem toan cho moi thay doi nghiep vu.

## 2. Nguoi dung muc tieu va gia tri

- **Khach vãng lai / CUSTOMER:** tim kiem, dat phong theo loai phong, thanh toan va tra cuu booking an toan.
- **ADMIN:** cau hinh danh muc phong, gia, coupon; xu ly booking, van hanh luu tru va doi soat thanh toan.
- **Chu co so:** thay doi du lieu van hanh nhu room type, price tier va price catalog ma khong sua ma nguon.

Gia tri cot loi la mot booking chi duoc xac nhan sau khi ton phong, gia, coupon va thanh toan da duoc xac thuc phia server.

## 3. MVP scope

| Nhom | Pham vi bat buoc |
|---|---|
| Co so va tien te | Mot property; VND; tien la so nguyen VND. |
| Phong | Room type, physical room, maintenance block, cap phat physical room khi tao HOLD. |
| Dat phong | Theo gio, qua dem, toi da 24 gio; input 15 phut; minimum 1 gio; availability, quote, HOLD va price snapshot. |
| Gia | Price tier/rate plan cau hinh; Lunch, 3-hour, 5-hour, Night, Day va Extra-hour combos. |
| Thanh toan | Thanh toan toan bo qua MoMo hoac VNPAY; webhook/IPN duoc xac thuc; reconciliation. |
| Khach hang | Guest checkout, Google login, email/password; booking lookup bang booking code va email OTP. |
| Van hanh | ADMIN quan ly phong, gia, coupon, booking, check-in/out, cancellation, payment review va audit. |
| Ho tro | Email bat dong bo sau commit; UI vi/en; dich may chi cho noi dung cong khai co duyet. |
| Bao mat | TLS/HTTPS, CDN/WAF, reverse proxy, server-side authorization, audit log. |

### Release boundary

MVP ket thuc khi mot khach co the nhan quote hop le, tao HOLD gan voi mot physical room, thanh toan thanh cong bang provider, nhan confirmation, va ADMIN co the van hanh booking den check-out. Gia van hanh cua cac combo ngoai Lunch va mapping room type-price tier phai duoc nhap va kich hoat truoc khi production activation; day la du lieu cau hinh, khong phai dieu kien chan Phase 0.

## 4. Ngoai pham vi

- Multi-property, multi-tenant, multi-currency, booking hon 24 gio.
- Loyalty, membership tier, AI chatbot, AI dynamic pricing.
- Microservices, Kubernetes, mobile application, OpenFGA.
- Cash, chuyen khoan thu cong, dat coc, refund tu dong, khach tu huy booking.
- Receptionist va Manager la role doc lap; SMS/phone OTP; Google People API lay so dien thoai.
- Dich PII, booking, payment hay ghi chu rieng tu qua translation provider.

## 4.1 Future considerations

Multi-property, refund workflow, role Receptionist/Manager, mobile application va loyalty chi duoc xem xet trong mot phase co business decision, threat review va acceptance criteria rieng. Chung khong duoc lam thay doi MVP contract hien tai.

## 5. Dieu kien va rang buoc

- Booking dung timezone `Asia/Ho_Chi_Minh`; timestamp duoc luu UTC; khoang thoi gian la `[checkIn, checkOut)`.
- Quote va HOLD co TTL 15 phut. HOLD block inventory ngay khi physical room duoc cap phat.
- Gia, coupon va amount do client gui len khong co tham quyen. Rule co gia bat buoc bi thieu khong duoc ACTIVE.
- Return URL chi dieu huong browser; booking chi CONFIRMED tu payment `SUCCEEDED` da verify signature, merchant, order identity va amount.
- Khong co refund policy tu dong trong MVP. Admin huy booking da thanh toan phai tao manual operational review.

## 6. Tieu chi thanh cong va acceptance

1. Khach chi thay room type; server cap phat mot physical room khong bi overlap trong HOLD, CONFIRMED hoac CHECKED_IN.
2. He thong sinh quote tu rate plan cau hinh va luu immutable price snapshot khi booking duoc xac nhan.
3. Webhook/IPN lap lai khong tao booking confirmation, coupon redemption hay email lap lai.
4. Khach guest chi xem booking sau khi xac minh booking code va email OTP.
5. ADMIN co the kiem toan state change, payment review, check-in, check-out va cancellation.

## 7. Gia dinh da khoa va phu thuoc

Gia dinh da khoa duoc liet ke tai [pricing rules](../domain/pricing-rules.md), [booking state machine](../domain/booking-state-machine.md) va [user roles](user-roles.md). Phu thuoc ben ngoai gom Google Identity Provider, MoMo, VNPAY, email provider, translation provider, object storage, CDN/WAF va observability.

## 8. Nguon bang chung

- **S-001:** Anh mo ta chuc nang do stakeholder cung cap: dat phong, combo, coupon, Google, MoMo, VNPAY va SSL.
- **S-002:** Bo quyet dinh Lượt 2 duoc phe duyet ngay 2026-07-21: product, allocation, time, state, pricing, coupon, security va non-goals.
- **S-003:** Dac ta Phase 0: yeu cau tai lieu, traceability, architecture va security acceptance gate.
