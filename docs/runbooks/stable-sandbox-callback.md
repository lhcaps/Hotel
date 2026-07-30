# Stable sandbox callback acceptance

Final VNPAY or MoMo sandbox acceptance requires either a named Cloudflare Tunnel with a stable hostname or a deployed staging HTTPS API hostname. Do not create a Cloudflare account/domain automatically; Quick Tunnels are exploratory only.

1. Configure exact `MOMO_RETURN_URL`, `MOMO_IPN_URL`, `VNPAY_RETURN_URL`, and `VNPAY_IPN_URL` with public HTTPS, non-loopback stable hostnames and the routes in `public-provider-callbacks.md`.
2. Register the exact callback values with the sandbox provider portal and configure only trusted proxy CIDRs. Never derive authority from `Host` or forwarded headers.
3. Verify the tunnel/deployment stays running and `GET /api/v1/health/live` returns 200 through the public hostname.
4. Run `pnpm check:providers`, then the provider-specific opt-in sandbox command. Record only synthetic booking/reference values, timestamp, final persisted states, and no secrets.

Current state: `PUBLIC_HTTPS_CALLBACK_LIVE=BLOCKED_PUBLIC_HTTPS_CALLBACK_UNAVAILABLE`. Local readiness does not prove public reachability or provider registration.
