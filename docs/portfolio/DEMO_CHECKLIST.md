# Demo readiness checklist

**BLOCKED / NOT VERIFIED at the documentation baseline.** These are preparation and acceptance criteria, not evidence of a passing fresh-checkout demo. On 2026-11-02, Windows `node --version` returned `v22.23.1` while `package.json` requires Node 24.x; `pnpm --version` returned `10.33.2`; `docker version --format '{{.Server.Version}}'` failed because the Docker daemon was unreachable. This clean worktree had no `node_modules`. No service, database, or provider was started or modified for this audit.

## Before a local-only rehearsal

- [ ] Use a clean checkout of the intended commit, Node 24.x, pnpm 10.33.2 and an available Docker Compose daemon.
- [ ] Inspect `.env.example` and use a new local-only configuration. Confirm PostgreSQL and all endpoints are loopback and the database name is disposable. Never use production credentials or shared databases.
- [ ] Inspect `scripts/demo/start.mjs`, `scripts/demo/demo-constants.mjs`, and `docs/runbooks/phase-6-local-demo.md` before starting. The Phase 6 runner uses ports 3100/3101 and a `room_management_demo_<uuid>` database. Do not assume the separate Windows archive runner in `README-DEMO.md` uses the same ports or lifecycle; it defaults to 3000/3001 and is not interchangeable.
- [ ] Review port ownership and use a fresh isolated environment. Do not terminate an unrelated listener or remove shared volumes.
- [ ] Validate the seeded pricing configuration and quote path. Static inspection did not find a published pricing-policy seed in `packages/database/scripts/demo-seed.ts` or `packages/database/src/seed-development.ts`; this is an open question, not a runtime diagnosis. Do not claim the demo works until an actual clean run proves it.
- [ ] Use synthetic fixture names and contacts under `.invalid` or `.example`; no real guest records, payment accounts, provider credentials, screenshots of private data, or customer-identifying assets.
- [ ] Record the source SHA, environment, commands, exit codes, and sanitized results. Distinguish source inspection from a passed runtime demonstration.

## Candidate local flow, after prerequisites are met

The existing Phase 6 runbook describes `pnpm install --frozen-lockfile`, `pnpm demo:preflight`, `pnpm demo:phase6`, and `pnpm demo:smoke`; follow its setup and owned-resource cleanup instructions only after checking them against the current scripts. `Ctrl+C` in the runner is its documented cleanup path; verify that it stopped only its own processes and disposable database. Do not use broad process termination or `docker compose down` against shared services. These commands have not been verified in this checkout.

A demo is accepted only when a fresh run records availability, quote and HOLD, safe teardown, and any relevant failure. A payment simulator, if separately verified, must be labeled **SIMULATED**. This checklist does not authorize live payments or deployment.
