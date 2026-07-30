# Phase 8F Provider Security Report

## Reviewed boundaries

- Server configuration schemas retain Google client secret, MoMo access/secret keys, VNPAY hash secret, and SMTP password outside `NEXT_PUBLIC_*`, API responses, ADMIN UI, database settings, and audit payloads.
- Public readiness responses contain only provider identity, enabled state, safe unavailable reason, and environment label where available.
- Browser return routes are `204` read-only. Only verified MoMo/VNPAY IPN flows invoke `applyVerifiedPaymentEvent`.
- MoMo signature verification requires JSON content type, configured partner code, and valid HMAC. VNPAY verifies the HMACSHA512 query and TmnCode before normalization.
- Playwright uses loopback OIDC/payment simulators only and turns traces off. Its runtime auth material is in memory.
- Worker SMTP credentials are passed only into nodemailer transport configuration; logs do not include credentials, full bodies, OTPs, or recipient address diagnostics.
- CI owns the approved Gitleaks scan. No secrets were added to tracked files in this phase.

## Verdicts

```text
PROVIDER_SECRET_GIT_LEAKS=0
PROVIDER_SECRET_LOG_LEAKS=0
PROVIDER_SECRET_BROWSER_LEAKS=0
OAUTH_TOKEN_URL_LEAKS=0
PAYMENT_SIGNATURE_LEAKS=0
SECOND_PAYMENT_SETTLEMENT_PATHS=0
SECRET_PROVIDER_FIELDS_IN_WEB=0
```

Live browser/provider artifacts are not created while configuration is blocked. A real acceptance run must retain only redacted application evidence and manual external confirmation.
