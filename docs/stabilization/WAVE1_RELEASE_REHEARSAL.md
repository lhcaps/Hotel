# Wave 1 isolated release rehearsal

Date: 2026-08-10. This rehearsal used the Wave 1 **isolated filesystem release target** on the local workstation. It invoked the governed `deploy-release.mjs` and `rollback-release.mjs` commands with `--target isolated --execute`; it did not start, stop, or inspect any production workload.

## Fresh command evidence

`pnpm test:release-integrity` exited `0` with 21 passing tests. The dedicated command `node scripts/release/rehearse-release.mjs` exited `0`.

| Step                  | Evidence                                                                               | Result          |
| --------------------- | -------------------------------------------------------------------------------------- | --------------- |
| Deploy A              | governed deploy CLI exit `0`, `DEPLOY=PASS`                                            | PASS            |
| Attest A              | manifest-to-snapshot attestation                                                       | PASS            |
| Deploy B              | same governed deploy CLI exit `0`, `DEPLOY=PASS`                                       | PASS            |
| Attest B              | manifest-to-snapshot attestation                                                       | PASS            |
| Inject API/worker mix | B snapshot with worker image from A; attestation and topology guard both returned FAIL | PASS (rejected) |
| Roll back B to A      | governed rollback CLI exit `0`, `ROLLBACK=PASS`                                        | PASS            |
| Attest restored A     | full governed-service snapshot                                                         | PASS            |

## Immutable rehearsal identities

| Release | Source SHA                                 | Release ID                                                                | Application image evidence                   |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------- |
| A       | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | `sha256:5736937ae2903084191c629b96ab9fd93eb450bd2271dbb0c037f2426bd122dc` | four `rehearsal/*@sha256:111…111` identities |
| B       | `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` | `sha256:77bba975fae9e2d13e025c80a3dc9ac6ec6e20845190aaa416b0a3c929f12aaf` | four `rehearsal/*@sha256:222…222` identities |

The source SHA, manifest release ID, application image digests, Compose/Caddy hashes, migration aggregate, and environment-schema hash differ between A and B. The test does not assert a Docker workload deployment: the Wave 1 target adapter materializes release artifacts and switches an isolated `current` pointer. A Docker-backed workload rehearsal remains a separate hardening follow-up before any production action.

`RELEASE_A_DEPLOY=PASS`  
`RELEASE_A_ATTESTATION=PASS`  
`RELEASE_B_DEPLOY=PASS`  
`RELEASE_B_ATTESTATION=PASS`  
`MIXED_RELEASE_REJECTION=PASS`  
`ROLLBACK_TO_A=PASS`  
`ROLLBACK_ATTESTATION=PASS`
