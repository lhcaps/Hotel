# PeaceNest successor handoff

## Status

| Field                                | Current recorded value                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Handoff source baseline              | `b1a9e2c60b1592e18646ec44e4cee6e1aea4e88a` on `main`                                                                               |
| Current local release-tool candidate | `3c1b954147fcebc1dce83abebfe2e505e5abb632`                                                                                         |
| Source CI evidence                   | GitHub Actions run `31893050453` passed for the handoff baseline `b1a9e2c…`; no fresh CI proof exists yet for candidate `3c1b954…` |
| Runtime release SHA                  | Not independently re-attested; current local candidate is not production proof                                                     |
| Production pricing policy            | Not independently inspected or published in this handoff                                                                           |
| Successor credential proof           | Pending human verification                                                                                                         |
| Handoff disposition                  | `RELEASE_CLOSURE_IN_PROGRESS`                                                                                                      |

The 2026-08-06 production acceptance and older delivery reports are historical context only. They do not establish the live runtime, provider, pricing, or access state on the date this handoff is read.

## What a successor receives

- The authoritative source is the committed `main` SHA named above, not an untracked overlay or local release directory.
- Governed release and rollback tooling is in `scripts/release/`; the deployment contract is in `deploy/README.md`.
- Local development, migration, and verification guidance is in [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).
- Security ownership and transfer controls are in [SECURITY_HANDOFF.md](SECURITY_HANDOFF.md) and [CREDENTIAL_TRANSFER_CHECKLIST.md](CREDENTIAL_TRANSFER_CHECKLIST.md).

## Required closure sequence

1. Reconfirm the candidate SHA and its CI result. If source changes, repeat all source and CI gates for the new SHA.
2. On the approved production operator path, capture fresh current-pointer, service-revision, recovery, backup, and disposable restore-rehearsal evidence.
3. Materialize the exact committed source, generate and verify its manifest, and run the tracked deploy dry run. A failing prerequisite leaves the current pointer unchanged.
4. Inspect pricing through the authorized lifecycle. Publish only a complete, preview-validated policy from authoritative data; otherwise retain the stable state and record the P0 blocker in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
5. Execute a governed release only after all preflight checks pass. Require strict attestation, topology verification, public-asset verification, and bounded public/API smoke evidence.
6. Produce a `git archive` from the final committed source SHA, hash it, scan the extracted package for secrets, and complete clean-room installation and core validation.
7. Complete the human credential-transfer checklist. Until every named console and operational path is proved by the successor, status is `READY_PENDING_HUMAN_CREDENTIAL_TRANSFER` and outgoing access remains unchanged.

## Non-negotiable boundaries

- Never run root-level `b0-*`, `check-*`, `deploy-*.sh`, archive contents, or other untracked helpers as release tooling.
- Never use direct production DDL, migration-history rewrites, invented prices, manual service restarts, broad Git staging, or real-payment probes.
- Never copy secret values into reports, source packages, terminal captures, or handoff material.
- A documentation-only handoff SHA is distinct from the immutable runtime release SHA. Any runtime code or runtime configuration change creates a new governed candidate.

## Completion rule

Only fresh immutable release/runtime evidence can close technical release work. Only human confirmation of GitHub, application admin, SSH, cloud, payment, and domain/DNS ownership can close credential transfer. Do not revoke outgoing access before that confirmation.
