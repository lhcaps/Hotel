# Tu dien domain chuan

**Trang thai:** Final - Phase 0. **Quy tac:** dung mot canonical term; `booking` la tu tieng Anh chuan, `dat phong` la tu tieng Viet tuong ung. Khong dung `reservation` nhu mot entity khac.

| Canonical term | Tieng Viet | English | Dinh nghia | Alias duoc phep | Cam / mo ho | Lien quan |
|---|---|---|---|---|---|---|
| Property | Co so luu tru | Property | Don vi luu tru duy nhat cua MVP | hotel/co so | branch, tenant | Room type |
| Room type | Loai phong | Room type | Nhom phong co capacity va rate plan | hang phong | phong so | Physical room |
| Physical room | Phong vat ly | Physical room | Phong co the cap phat va block inventory | room | room type | Booking |
| Availability | Kha dung | Availability | Kha nang cap mot physical room cho interval | phong trong | chi so dem phong | HOLD |
| Booking | Dat phong | Booking | Cam ket van hanh gan interval, guest, room va price snapshot | reservation | payment order | HOLD/CONFIRMED |
| DRAFT | Ban nhap | Draft | Trang thai chi tren client truoc khi tao HOLD | form tam | persisted booking | Client-only |
| HOLD | Giu phong | Hold | Booking persisted 15 phut, cap physical room va block inventory | reservation hold | payment pending | Booking state |
| Price quote | Bao gia | Price quote | Ket qua gia server-side co TTL 15 phut | quote | final payment evidence | Pricing |
| Rate plan | Ke hoach gia | Rate plan | Cau hinh gia gan room type/price tier | price catalog | hard-coded price | Pricing rule |
| Price tier | Nhom gia | Price tier | Nhom gia van hanh ma room type duoc gan | tier | room type name | Lunch amount |
| Pricing rule | Quy tac gia | Pricing rule | Rule co priority, dieu kien va amount cau hinh | combo rule | UI formula | PRC |
| Combo | Goi gia | Combo | Base pricing component theo time window/duration | package | booking state | PRC |
| Extra hour | Gio phu troi | Extra hour | Don vi 60 phut lam tron len cho duration vuot included duration | phu thu gio | partial floating charge | PRC |
| Check-in/out | Nhan/tra phong | Check-in/out | Moc bat dau/ket thuc occupancy va thao tac Admin | vao/ra | payment time | Interval |
| Guest | Khach vãng lai | Guest | Nguoi dat khong can account | guest customer | anonymous booking access | OTP |
| Customer | Khach hang | Customer | Account da xac thuc hoac chu so huu booking | user | ADMIN | Identity |
| Adult / Child | Nguoi lon / Tre em | Adult / Child | So luong dung capacity; child khong co surcharge MVP | occupancy | infant/age band | Capacity |
| Coupon | Ma giam gia | Coupon | Cau hinh discount server-side | voucher | client discount | CPN |
| Coupon reservation | Giu luot coupon | Coupon reservation | Dat cho usage limited trong HOLD | RESERVED | redemption | Coupon lifecycle |
| Payment order | Lenh thanh toan | Payment order | Don hang merchant gui provider | payment | booking | Payment attempt |
| Payment attempt | Lan thanh toan | Payment attempt | Mot lan thu thanh toan co state doc lap | transaction | booking state | Payment lifecycle |
| Payment transaction | Giao dich thanh toan | Payment transaction | Ket qua provider da map/xac minh | provider event | browser return | SUCCEEDED |
| Webhook/IPN | Callback may-chu | Webhook/IPN | Thong diep provider den server, co signature | provider callback | return URL | Payment authority |
| Return URL | URL quay lai | Return URL | Dieu huong browser sau payment | redirect | payment proof | Non-authoritative |
| Reconciliation | Doi soat | Reconciliation | Xu ly mismatch, late success va manual payment review | payment review | auto confirmation | REVIEW_REQUIRED |
| Audit event | Su kien kiem toan | Audit event | Ban ghi append-only ve action/state change | audit log | editable history | INV-025 |
| Idempotency key | Khoa idempotency | Idempotency key | Khoa lam cung request tra lai ket qua da co | request key | duplicate business effect | Payment/HOLD |
| Maintenance block | Chan bao tri | Maintenance block | Khoang physical room khong duoc cap | out of service | cancelled booking | INV-030 |
| No-show | Khach khong den | No-show | State do ADMIN danh dau sau expected check-in | absent | auto expiry | Booking state |
| Cancellation | Huy booking | Cancellation | ADMIN huy truoc check-in | cancel | automated refund | CANCELLED |
| Refund | Hoan tien | Refund | Xu ly tai chinh sau cancellation | reimbursement | booking state | Non-goal MVP |

## Nguon su that

Booking platform so huu booking, price snapshot, coupon lifecycle va audit event. Payment provider so huu external outcome; platform verify va map outcome. PostgreSQL la transactional source of truth duoc de xuat; Redis khong so huu state nghiep vu.
