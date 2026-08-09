# Wave 1 isolated release rehearsal

Date: 2026-08-10. This rehearsal used an ephemeral local Docker Compose project with no published ports and no production target. It built two disposable application images from the local API image, created the governed service topology (`caddy`, `web`, `api`, `worker`, `payment-demo`, `postgres`, `redis`, and `migrate`), and removed the project, network, temporary release directories, and generated images on completion.

## Fresh command evidence

`pnpm test:release-integrity` exited `0` with 22 passing tests. The executable command `node scripts/release/rehearse-compose-workload.mjs` exited `0`.

| Step                  | Evidence                                                                                                                | Result          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| Deploy A              | Governed deploy CLI exit `0`, verified manifest/schema/migration and local image IDs, `DEPLOY=PASS`                     | PASS            |
| Attest A              | Project-scoped Docker attestation CLI exit `0`, `RELEASE_ATTESTATION=PASS`                                              | PASS            |
| Deploy B              | Same governed deploy CLI against a different image ID and manifest, exit `0`                                            | PASS            |
| Attest B              | Project-scoped Docker attestation CLI exit `0`                                                                          | PASS            |
| Inject API/worker mix | Controlled Compose recreation of API from A while B worker remained; attestation and topology CLIs both exited non-zero | PASS (rejected) |
| Restore B             | Controlled full Compose recreation followed by strict B attestation                                                     | PASS            |
| Roll back B to A      | Governed rollback CLI exit `0`, `ROLLBACK=PASS`                                                                         | PASS            |
| Attest restored A     | Project-scoped Docker attestation CLI exit `0`                                                                          | PASS            |

## Immutable rehearsal identities

| Release | Source SHA                                 | Release ID                                                                | Application image evidence            |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------- |
| A       | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | `sha256:cfe1770890e0ccc14dc147535f84617bcdf40c969d8080891f1fa2d5cf1719f4` | local image ID `sha256:db2cb9529a2e…` |
| B       | `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` | `sha256:0e639323855e4200b9ead42bb6287084906e799089ae29ec69bd18640d430c61` | local image ID `sha256:fdbf96460eb6…` |

The source SHA, manifest release ID, and actual Docker image IDs differ between A and B. Both artifacts verified their Compose/Caddy hashes, migration aggregate, environment schema, service-env allowlists, and exact image IDs before mutation. The test topology deliberately uses benign sleep commands rather than customer-facing application startup; it proves governed container lifecycle, identity, ownership, and rollback mechanics without introducing production data or network access.

`RELEASE_A_DEPLOY=PASS`  
`RELEASE_A_ATTESTATION=PASS`  
`RELEASE_B_DEPLOY=PASS`  
`RELEASE_B_ATTESTATION=PASS`  
`MIXED_RELEASE_REJECTION=PASS`  
`ROLLBACK_TO_A=PASS`  
`ROLLBACK_ATTESTATION=PASS`
