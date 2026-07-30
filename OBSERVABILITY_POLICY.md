# Observability policy

API and worker emit structured JSON logs with service, environment, request ID and correlation ID when available. Do not log raw bodies, secrets, passwords, tokens, URLs with credentials or unnecessary PII. Sentry/OpenTelemetry remain integration boundaries until production-hardening work; they are not dependencies in Phase 1.
