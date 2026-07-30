# Phase 8I external acceptance report

Fresh commands on 2026-07-29 used no provider credentials, browser passwords, tokens, or customer data.

| Provider / boundary | Command or check                  | Exact result                                                                | Verdict                                     |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| Google local OAuth  | `pnpm test:e2e:google-live-local` | `LIVE_ACCEPTANCE=NOT_RUN_MANUAL_CHECKPOINT_REQUIRED`                        | `BLOCKED_USER_INTERACTION_REQUIRED`         |
| MoMo sandbox        | `pnpm test:e2e:momo-sandbox`      | `MOMO_SANDBOX_LIVE=BLOCKED_MISSING_MERCHANT_CREDENTIALS`                    | blocked                                     |
| VNPAY sandbox       | `pnpm check:providers`            | `VNPAY_SANDBOX_READY=READY`, `PUBLIC_HTTPS_CALLBACK_READY=EXTERNAL_BLOCKED` | `BLOCKED_PUBLIC_HTTPS_CALLBACK_UNAVAILABLE` |
| SMTP live           | `pnpm test:email:live`            | `SMTP_LIVE=BLOCKED_MISSING_SMTP_CREDENTIALS`                                | blocked                                     |
| Callback authority  | `pnpm check:providers`            | `CALLBACK_URL_SINGLE_AUTHORITY=PASS`, `CALLBACK_HOST_VALIDATION=PASS`       | pass                                        |

`READY` is configuration readiness, not a live external acceptance. Google requires a person to complete the provider login; no password/MFA/cookie/token automation is permitted. MoMo requires sandbox merchant credentials. VNPAY needs registered public HTTPS callback URLs before a sandbox transaction can be accepted. SMTP needs a dedicated sender and test recipient.

Use `docs/runbooks/google-oauth-local.md`, `vnpay-sandbox.md`, `production-smtp.md`, and `public-provider-callbacks.md` for the authorized next steps.
