# Phase 8H Pricing Adjustment Reconciliation

| Concept | Owner and authority | Persistence | UI label | Who may modify | Verdict |
| --- | --- | --- | --- | --- | --- |
| Base/rate-plan price | pricing service and immutable quote snapshot | rate plan price and booking snapshot | Rate-plan price | ADMIN catalog permission | Existing governed model |
| Coupon discount | coupon evaluation and booking coupon snapshot | booking discount and coupon application | Coupon discount | ADMIN coupon catalogue; customer provides a code only | Existing governed model |
| Extra-hour price | non-base `EXTRA_HOUR` rate plan price | rate plan price and quote snapshot | Extra-hour rate | ADMIN catalog permission | Existing governed model |
| Booking final amount | booking aggregate | immutable `finalAmountVnd` | Final amount | No browser or free-form ADMIN edit | Existing governed model |
| Manual surcharge | no safe owner | not stored | Not displayed | Nobody | `DOMAIN_CHANGE_REQUIRED_AUDITED_ADJUSTMENTS` |

No Phase 8H free-form money adjustment is permitted. A future manual adjustment requires a reason, actor, bounds, immutable audit record, authoritative quote regeneration, and a dedicated approval review.
