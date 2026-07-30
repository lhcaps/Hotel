# Public Provider Callbacks

## Authority

`MOMO_RETURN_URL`, `MOMO_IPN_URL`, `VNPAY_RETURN_URL`, and `VNPAY_IPN_URL` are the single authoritative callback values. They are validated by `pnpm check:providers` and the API environment schema. Do not derive callbacks from `Host` or `X-Forwarded-Host`.

A public callback base must be HTTPS, have no URL userinfo or fragment, and use a non-loopback public host. Trusted proxy behavior is limited to configured `TRUSTED_PROXY_CIDRS`; untrusted forwarded headers are not accepted as authority.

## Routes

| Provider   | Purpose        | Method | Path                                      | Content type       |
| ---------- | -------------- | ------ | ----------------------------------------- | ------------------ |
| MoMo       | IPN            | POST   | `/api/v1/webhooks/momo`                   | `application/json` |
| MoMo       | browser return | GET    | `/api/v1/payments/providers/momo/return`  | none               |
| VNPAY      | IPN            | GET    | `/api/v1/webhooks/vnpay`                  | signed query       |
| VNPAY      | browser return | GET    | `/api/v1/payments/providers/vnpay/return` | none               |
| API health | liveness       | GET    | `/api/v1/health/live`                     | none               |

The browser return routes are read-only `204` boundaries. They never settle payment. Only a verified signed IPN reaches the existing `applyVerifiedPaymentEvent` settlement boundary.

## TLS and network requirements

Terminate TLS at the public edge, forward to the API only through an explicitly trusted proxy, preserve raw MoMo request bytes, and allow the provider to reach the IPN route. Apply edge rate limits that permit legitimate provider retries; do not add a browser-facing settlement route.

Before sandbox acceptance, register the exact HTTPS return and IPN URLs in each provider portal and run `pnpm check:providers`.
