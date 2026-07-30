# Phase 8H Payment Collection Gap

The current model has exactly one `payments` aggregate for each booking. A payment aggregate owns one full booking amount; `payment_attempts` records provider attempts with positive full-payment amounts. Settlement is driven by authenticated provider events and reconciliation, never by a browser return.

The workbook's two-entry pattern is therefore not represented safely. It is not treated as two attempts, because two attempts race to settle one aggregate; it is not a deposit/balance model, because neither remaining balance nor partial collection invariants exist; and it is not manual accounting, because no audited collection ledger exists.

`PARTIAL_PAYMENT=DOMAIN_CHANGE_REQUIRED_DEFERRED`.

Any future design must define a payment-allocation ledger, remaining-balance invariant, currency rounding, booking-confirmation threshold, duplicate-provider-event reconciliation, coupon interaction, authorization, and audit/settlement reporting. This phase changes none of those rules.
