# Known issues and release blockers

## Final handoff state

- `FINAL_SOURCE_SHA`: exact immutable SHA of the final committed `main` tree, recorded in the final evidence (`git rev-parse HEAD`).
- `FINAL_PRODUCTION_SHA`: the same SHA after canonical governed deployment and strict attestation.
- `HANDOFF_STATUS`: `TECHNICAL_HANDOFF=PASS`; `CREDENTIAL_TRANSFER=PENDING_HUMAN`.

## Active transfer blocker

| Priority | Blocker | Impact | Required evidence |
| --- | --- | --- | --- |
| P0 | Human successor access has not yet been independently proved. | The project must not be marked `READY_FOR_SUCCESSOR`; outgoing access remains intact. | Human verification of GitHub, application admin, SSH, cloud, payment, and domain/DNS access, recorded without credential values. |

## Historical evidence limitation

The tracked production reports and earlier delivery records remain useful append-only history, but they use older source identities and point-in-time environments. They are preserved in [docs/archive/2026-08](archive/2026-08/) and cannot override the final exact-SHA evidence. The untracked worktree inventory is preserved for owner review and is never governed release tooling.

## Non-issues that still require care

- A passing local or CI gate does not establish external-provider readiness or production health without the matching governed runtime evidence.
- Pricing remains server-authorized: inspect first and publish only a complete, validated, preview-equivalent policy. The final handoff performs read-only inspection only.
- A recovery plan is not authorization to execute a rollback; rollback is separately approval-gated.

## Closure status

Technical closure is `PASS` when the final evidence bundle contains every requested source, CI, production, pricing, workflow, Gitleaks, archive, and clean-room gate. Credential transfer remains `PENDING_HUMAN` until every owner accepts independent successor proof.
