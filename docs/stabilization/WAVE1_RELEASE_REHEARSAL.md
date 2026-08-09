# Wave 1 isolated release rehearsal

Date: 2026-08-10. This rehearsal used an ephemeral local Docker Compose project with no published ports and no production target. It built two disposable application images from the local API image, created the governed service topology (`caddy`, `web`, `api`, `worker`, `payment-demo`, `postgres`, `redis`, and `migrate`), and removed the project, network, temporary release directories, and generated images on completion.

## Fresh command evidence

`pnpm test:release-integrity` exited `0` with 22 passing tests. The executable command `node scripts/release/rehearse-compose-workload.mjs` exited `0`.

| Step                  | Evidence                                                                                                                                                                                                     | Result          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Deploy A              | Governed deploy CLI exit `0`; verified manifest/schema/migration, backup-evidence contract, disk, current-release truth, candidate uniqueness, resolved Compose topology, and local image IDs; `DEPLOY=PASS` | PASS            |
| Attest A              | Project-scoped Docker attestation CLI exit `0`, `RELEASE_ATTESTATION=PASS`                                                                                                                                   | PASS            |
| Deploy B              | Same governed deploy CLI against a different image ID and manifest, exit `0`                                                                                                                                 | PASS            |
| Attest B              | Project-scoped Docker attestation CLI exit `0`                                                                                                                                                               | PASS            |
| Inject API/worker mix | Controlled Compose recreation of API from A while B worker remained; attestation and topology CLIs both exited non-zero                                                                                      | PASS (rejected) |
| Restore B             | Controlled full Compose recreation followed by strict B attestation                                                                                                                                          | PASS            |
| Roll back B to A      | Governed rollback CLI exit `0`; verified current release manifest, rollback migration compatibility, service environments, resolved Compose topology, and immutable local image IDs; `ROLLBACK=PASS`         | PASS            |
| Attest restored A     | Project-scoped Docker attestation CLI exit `0`                                                                                                                                                               | PASS            |

## Immutable rehearsal identities

| Release | Source SHA                                 | Release ID                                                                | Application image ID                                                      | Manifest SHA-256                                                   |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A       | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | `sha256:db4d11062e8ce3506d0a3d25d4dc7351bf91802a15838e6567008091fb01d458` | `sha256:7f99d1e4b2b07be9aa4af66d685b14dc6b89feaae2638abb9cce62861cbe3afd` | `4d02c1621a86db2acbe9282a6886779195f47c12c0fe7bfb5ffb11514d151828` |
| B       | `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` | `sha256:7529984a7603fd0fcb393259584647d1d537d55525e3f49edecf14c94aa3b947` | `sha256:709652a4ceeb79228a5b029a0c030777dbbcbd36a2431f35d4ba5bf799600bd2` | `4e3db90dc2f7e921cd08275f841045a7ef05b1c89c509f1fccc232f53902c8a1` |

The source SHA, manifest release ID, and actual Docker image IDs differ between A and B. Both artifacts verified their Compose/Caddy hashes, migration aggregate, environment schema, service-env allowlists, exact image IDs, and deploy/rollback preflight contracts before mutation. The test topology deliberately uses benign sleep commands rather than customer-facing application startup; it proves governed container lifecycle, identity, ownership, and rollback mechanics without introducing production data or network access.

`RELEASE_A_DEPLOY=PASS`  
`RELEASE_A_ATTESTATION=PASS`  
`RELEASE_B_DEPLOY=PASS`  
`RELEASE_B_ATTESTATION=PASS`  
`MIXED_RELEASE_REJECTION=PASS`  
`ROLLBACK_TO_A=PASS`  
`ROLLBACK_ATTESTATION=PASS`
