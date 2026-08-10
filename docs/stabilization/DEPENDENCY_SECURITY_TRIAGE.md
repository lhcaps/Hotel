# Dependency security triage

## RM-504 closure update (2026-08-10)

The remediation in `6cb3873` is verified by a fresh `pnpm audit --prod --audit-level=high`: 0 high and 0 critical findings (the audit reports only 1 low and 2 moderate findings). The dependency regression remains enforced by `pnpm check:release-integrity`.

`RM504_STATUS=PASS`
`DEPENDENCY_AUDIT=PASS_HIGH_0_CRITICAL_0`

## Historical pre-RM-504 evidence (not current release truth)

The following is the retained pre-remediation snapshot. It records the six
high findings that RM-504 addressed; it is not the result of the current
release-candidate audit and must not override the PASS status above.

Historical command: `pnpm audit --prod --audit-level=high --json` on
2026-08-10. Exit code: `1`. Result: 6 HIGH findings, 0 critical, 820
production dependencies. No dependency update had been made at that snapshot.

| Advisory                             | Package / current     | Dependency path                                                                  | Direct     | Runtime reachability | Affected service               | Patched version | Recommended action                                                                             |
| ------------------------------------ | --------------------- | -------------------------------------------------------------------------------- | ---------- | -------------------- | ------------------------------ | --------------- | ---------------------------------------------------------------------------------------------- |
| GHSA-4cwx-7wf7-3272 / CVE-2026-13697 | undici 7.28.0         | `apps__api > better-auth > vitest > jsdom > undici`                              | Transitive | UNKNOWN              | API test/auth dependency tree  | >=7.29.0        | Trace production package inclusion; update upstream chain in dedicated dependency remediation. |
| GHSA-7p8r-x3mc-p8w7 / CVE-2026-18446 | fast-uri 4.1.1        | `apps__api > fastify > fast-json-stringify > fast-uri`                           | Transitive | YES                  | API                            | >=4.1.2         | Prioritize Fastify-compatible update; affects URI host-policy parsing.                         |
| GHSA-7p8r-x3mc-p8w7 / CVE-2026-18446 | fast-uri 3.1.4        | `apps__api > fastify > @fastify/ajv-compiler > fast-uri`                         | Transitive | YES                  | API                            | >=3.1.5         | Prioritize with the other Fastify chain; regression-test validation and URL policy.            |
| GHSA-rgw5-rvv9-x895 / CVE-2026-69152 | brace-expansion 5.0.8 | `apps__web > shadcn > ts-morph > @ts-morph/common > minimatch > brace-expansion` | Transitive | UNKNOWN              | Web tooling dependency tree    | >=5.0.9         | Update through the tooling chain; validate build/code-generation behavior.                     |
| GHSA-5p4m-2wfm-xmqj                  | js-yaml 4.3.0         | `apps__web > shadcn > cosmiconfig > js-yaml`                                     | Transitive | UNKNOWN              | Web tooling dependency tree    | >=4.3.1         | Update through cosmiconfig/shadcn compatibility path; assess untrusted YAML use.               |
| GHSA-2v37-7h3g-55p8 / CVE-2026-67213 | nanoid 3.3.16         | `apps__api > better-auth > vitest > vite > postcss > nanoid`                     | Transitive | UNKNOWN              | API test/build dependency tree | >=3.3.17        | Update upstream chain; validate generated IDs and bundling.                                    |

The audit reports exploit preconditions involving cache interception, URI policy parsing, untrusted glob/YAML inputs, or an attacker-controlled custom Nano ID size. Only the two `fast-uri` paths are classified runtime reachable because Fastify and its validation/serialization stack are runtime API dependencies. The other paths are not asserted unreachable without a package/runtime trace.

Expected blast radius is dependency-lockfile and API/web test/build behavior, not release-artifact semantics. Track remediation in a dedicated security workstream; do not intermingle it with production reconciliation.

`HISTORICAL_DEPENDENCY_AUDIT=FAIL_KNOWN_SECURITY_FINDINGS`
