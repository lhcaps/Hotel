# VNPAY Sandbox Activation

Configure only sandbox values: `VNPAY_ENABLED=true`, `VNPAY_ENVIRONMENT=sandbox`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_API_BASE_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`, `VNPAY_RETURN_URL`, and `VNPAY_IPN_URL`.

Register the exact public HTTPS callback URLs from `public-provider-callbacks.md`. Run `pnpm check:providers`, then `pnpm test:e2e:vnpay-sandbox`. Do not automate a banking password or OTP.

The adapter signs lexically sorted fields with HMACSHA512 and applies VNPAY transport amount scaling exactly once. Browser return values do not settle payments; signed IPN verification does.
