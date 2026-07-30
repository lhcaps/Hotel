# SSL and callback setup

## Repository-proven configuration

- Set `WEB_ORIGIN` and `AUTH_BASE_URL` to the public HTTPS origin in production.
- Set `TRUSTED_PROXY_CIDRS` to the comma-separated addresses/CIDRs of the reverse proxy. Leave it empty when the API is directly exposed; forwarded headers are then not trusted.
- Configure the proxy to pass `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto=https`, and the original client IP. The proxy, not the application, owns HTTP-to-HTTPS redirects and HSTS.
- Configure Google, MoMo, and VNPAY return/IPN callback URLs on the same public HTTPS domain. Production validation rejects public HTTP and loopback callbacks.

## Operator acceptance

1. Terminate TLS at the reverse proxy with a valid certificate for the public hostname.
2. Confirm the proxy is the only network peer allowed to reach the API listener.
3. Confirm `X-Forwarded-Proto` is `https` only from an address in `TRUSTED_PROXY_CIDRS`.
4. Register the exact Google redirect URI and MoMo/VNPAY return and IPN paths with their providers.
5. Run a non-payment health request through the public hostname, then execute each provider sandbox callback procedure.

## Verdict boundary

`HTTPS_CONFIGURATION_READINESS=PASS` is supported by configuration validation and trusted-proxy wiring. `PUBLIC_DOMAIN_AND_CERTIFICATE=EXTERNAL_BLOCKED` until an operator supplies a domain, certificate, proxy deployment, provider credentials, and public callback evidence.
