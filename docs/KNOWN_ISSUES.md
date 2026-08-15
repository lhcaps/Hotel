# Known issues and release blockers

## Active release-closure blockers

| Priority | Blocker                                                                          | Impact                                                                                          | Required evidence before closure                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Live runtime identity has not been freshly re-attested for the candidate source. | No claim of production release health, service consistency, or public smoke is valid.           | Current-pointer, service revision, strict attestation, topology, public-asset, and smoke PASS results from the governed path.                                       |
| P0       | Universal pricing has not been freshly inspected and validated in this handoff.  | No pricing policy may be described as published, and no bootstrap/publish action is authorized. | Authorized draft/active inspection, complete component and price validation, preview parity, and lifecycle evidence; otherwise an explicit retained-state decision. |
| P0       | Human successor access has not been proved.                                      | The project is not `READY_FOR_SUCCESSOR`; outgoing access must remain intact.                   | Human verification of GitHub, app admin, SSH, cloud, payment, and domain/DNS access, recorded without values.                                                       |
| P1       | Root worktree contains untracked historical, forensic, and unknown material.     | It must not affect releases or source packages; semantic work may require later review.         | Individual classification and explicit owner decision. Never use it as governed tooling.                                                                            |

## Historical evidence limitation

The tracked production acceptance dated 2026-08-06 and earlier delivery reports use older source identities and partial status. They remain useful historical records but cannot be promoted to current proof. The local release-tool candidate `3c1b954147fcebc1dce83abebfe2e505e5abb632` has clean-room source/build evidence but no fresh CI, runtime, pricing, or production attestation. The untracked `RELEASE_ATTESTATION_2026-08-15.md` is not valid attestation evidence.

## Non-issues that still require care

- A passing local or CI gate does not establish external-provider readiness or production health.
- The V3 pricing reader and multi-night public path have explicit dark/approval boundaries. Do not treat implementation presence as public activation.
- A recovery plan is not authorization to execute a rollback; rollback is separately approval-gated.

## Closure status

Technical closure is pending the P0 evidence above. If the technical gates pass before human transfer, the only permissible status is `READY_PENDING_HUMAN_CREDENTIAL_TRANSFER`.
