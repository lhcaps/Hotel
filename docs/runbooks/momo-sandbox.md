# MoMo Sandbox Activation

Configure only sandbox credentials in environment: `MOMO_ENABLED=true`, `MOMO_ENVIRONMENT=sandbox`, `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_API_BASE_URL=https://test-payment.momo.vn`, `MOMO_RETURN_URL`, and `MOMO_IPN_URL`.

Register the exact public HTTPS callback URLs from `public-provider-callbacks.md` in the MoMo sandbox portal. Run `pnpm check:providers`, then `pnpm test:e2e:momo-sandbox`. The command refuses an incomplete configuration and does not automate a wallet password, PIN, or OTP.

A successful browser return is not payment evidence. Retain application audit evidence only after a signed IPN has verified merchant, order, amount, currency, and idempotency.
