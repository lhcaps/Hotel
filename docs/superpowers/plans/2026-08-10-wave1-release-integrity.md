# Wave 0 and Wave 1 Release Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement RM-501, RM-101, RM-102, and RM-103 so an immutable release can be verified, planned, rehearsed, attested, and rolled back without production mutation.

**Architecture:** A focused Node ESM release kernel under scripts/release owns canonical hashing, manifest identity, environment allowlists, topology checks, runtime attestation, and release state transitions. Thin CLIs consume that kernel, run dry by default, and allow isolated execution only through an explicit target-root adapter. The existing migration provenance file stays authoritative.

**Tech Stack:** Node 24 ESM, node:test, JSON Schema, Docker Compose metadata, GitHub Actions, pnpm 10.33.2, existing Drizzle migration provenance.

## Global Constraints

- Work only in D:\Study\Project\Room Management-wave1-release-integrity on codex/stabilize-release-integrity.
- Do not mutate production, print secret values, or change feature flags.
- Do not modify multi-night, pricing, booking, OTP, payment reconciliation, customer frontend flow, database lifecycle constraints, email/outbox behavior, monitoring, or backup implementation.
- All deployment and rollback commands default to dry-run and reject production execution without an explicit typed confirmation.
- Released migration SQL files and packages/database/drizzle/migration-provenance.json remain the migration authority.
- Every test must exercise command or policy behavior with hand-derived fixtures; it must not assert source text.
- Mandatory CI checks must fail normally; they may not use continue-on-error, allow_failure, or success-forcing shell syntax.

---

## File Structure

| Path                                         | Responsibility                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| .github/workflows/ci.yml                     | Deterministic CI bootstrap and Wave 1 gates                                 |
| deploy/release-manifest.schema.json          | Machine-readable manifest contract                                          |
| deploy/release-manifest.example.json         | Redacted immutable example                                                  |
| deploy/environment-schema.json               | Value-free key inventory, classification, allowlists, production rules      |
| docker-compose.production.yml                | Canonical service-specific environment-file references                      |
| scripts/release/lib/canonical.mjs            | Canonical JSON, SHA-256, parsing, safe error primitives                     |
| scripts/release/lib/migrations.mjs           | Existing-provenance migration-set derivation                                |
| scripts/release/lib/manifest.mjs             | Manifest construction and artifact verification                             |
| scripts/release/lib/environment.mjs          | Key inventory, allowlist validation, safe environment rendering             |
| scripts/release/lib/topology.mjs             | Canonical Compose and runtime topology rules                                |
| scripts/release/lib/attestation.mjs          | Full-service sanitized runtime comparison                                   |
| scripts/release/lib/release-state.mjs        | Atomic target-root state transitions and deterministic failure handling     |
| scripts/release/lib/preflight.mjs            | Deploy and rollback preflight plans                                         |
| scripts/release/*.mjs                        | Generate, verify, validate, render, attest, deploy, rollback, rehearse CLIs |
| scripts/release/*.test.mjs                   | Behavior-focused Node test suites                                           |
| docs/audit/WAVE1_CURRENT_RELEASE_PIPELINE.md | Intended versus actual pipeline and script classification                   |
| docs/stabilization/*.md                      | Wave 0 truth, Wave 1 report, dependency triage, reconciliation plan         |
| WAVE1_SUMMARY.txt                            | Exact final release-integrity status and gate outcomes                      |

### Task 1: Repair CI bootstrap and establish release-tool test commands

**Files:**

- Modify: .github/workflows/ci.yml
- Modify: package.json
- Create: scripts/release/release-cli.test.mjs
- Create: scripts/release/generate-release-manifest.mjs
- Create: scripts/release/verify-release-manifest.mjs

**Interfaces:**

- Consumes packageManager value pnpm@10.33.2.
- Produces pnpm test:release-integrity and pnpm check:release-integrity.
- Every release CLI returns help without target paths or environment values.

- [ ] **Step 1: Write the failing CLI-help test**

```js
test('release CLI help does not require target or environment input', () => {
  const result = spawnSync(process.execPath, [
    'scripts/release/generate-release-manifest.mjs',
    '--help',
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: node --test scripts/release/release-cli.test.mjs

Expected: FAIL because the release CLI is absent.

- [ ] **Step 3: Add minimal CLI help and package test commands**

```json
{
  "test:release-integrity": "node --test scripts/release/*.test.mjs",
  "check:release-integrity": "pnpm test:release-integrity"
}
```

- [ ] **Step 4: Repair workflow ordering and add mandatory release checks**

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10.33.2
- uses: actions/setup-node@v4
  with:
    node-version: 24.18.0
    cache: pnpm
```

Keep checkout, package setup, Node/cache, frozen install, format, lint, typecheck, unit, integration/auth, pricing/availability/quote, OpenAPI, migration/schema, dependency audit, secret scan, build, and Wave 1 checks in that order.

- [ ] **Step 5: Verify and commit**

Run: node --test scripts/release/release-cli.test.mjs

Run: pnpm format:check -- .github/workflows/ci.yml package.json scripts/release/release-cli.test.mjs

Expected: PASS.

Commit:

```bash
git add .github/workflows/ci.yml package.json scripts/release
git commit -m "ci: bootstrap pnpm before cache and add release gates"
```

### Task 2: Implement immutable manifest identity and migration provenance verification

**Files:**

- Create: deploy/release-manifest.schema.json
- Create: deploy/release-manifest.example.json
- Create: scripts/release/lib/canonical.mjs
- Create: scripts/release/lib/migrations.mjs
- Create: scripts/release/lib/manifest.mjs
- Create: scripts/release/release-manifest.test.mjs

**Interfaces:**

- Produces createManifest(input), releaseIdentity(manifest), verifyManifest(input), and deriveMigrationSet(repositoryRoot).
- createManifest accepts source SHA, four repository/digest image records, artifact paths, createdAt, and rollback-compatible migration digests.
- verifyManifest returns verified manifest data or throws an invariant-specific, value-free error.

- [ ] **Step 1: Write failing tests for identity stability and artifact mismatch**

```js
test('createdAt does not change immutable release identity', () => {
  assert.equal(
    createManifest({ ...baseInput, createdAt: '2026-08-10T00:00:00.000Z' }).releaseId,
    createManifest({ ...baseInput, createdAt: '2026-08-10T01:00:00.000Z' }).releaseId,
  );
});

test('verification rejects a changed Compose artifact', () => {
  writeFileSync(join(releaseDirectory, 'docker-compose.production.yml'), 'services: {}\n');
  assert.throws(() => verifyManifest({ manifest, releaseDirectory }), /Compose digest/);
});
```

Add independent tests for malformed SHA, missing service, mutable image, changed Caddy, migration change, environment-schema change, and manifest tampering.

- [ ] **Step 2: Run the manifest suite to verify it fails**

Run: node --test scripts/release/release-manifest.test.mjs

Expected: FAIL because manifest functions are absent.

- [ ] **Step 3: Implement canonical identity and provenance checks**

```js
export function canonicalJson(value) {
  /* recursive lexical object-key sort */
}
export function sha256(value) {
  /* lowercase SHA-256 hex */
}
export function releaseIdentity(manifest) {
  /* omit createdAt and releaseId */
}
```

Verify every SQL migration against its provenance hash, verify journal order, and hash verified index/filename/digest tuples in index order.

- [ ] **Step 4: Add schema, redacted example, generator, verifier, and tests**

Require four app images with immutable digests, exact source/artifact digests, and rollback compatibility evidence. The example uses only synthetic digests and non-routable repository names.

- [ ] **Step 5: Verify and commit**

Run: node --test scripts/release/release-manifest.test.mjs scripts/release/release-cli.test.mjs

Expected: PASS.

Commit:

```bash
git add deploy/release-manifest.schema.json deploy/release-manifest.example.json scripts/release package.json
git commit -m "feat: add immutable release manifest verification"
```

### Task 3: Implement source-derived environment schema and per-service allowlists

**Files:**

- Create: deploy/environment-schema.json
- Modify: docker-compose.production.yml
- Create: scripts/release/lib/environment.mjs
- Create: scripts/release/validate-release-environment.mjs
- Create: scripts/release/render-service-environments.mjs
- Create: scripts/release/release-environment.test.mjs

**Interfaces:**

- Produces validateEnvironment(input) and renderServiceEnvironments(input).
- renderServiceEnvironments returns service names, rendered file paths, and key names only.
- Compose receives an explicit service environment file rather than the global shared secret file.

- [ ] **Step 1: Write failing allowlist and unsafe-value tests**

```js
test('web rejects database configuration even with a valid browser origin', () => {
  assert.throws(
    () =>
      renderServiceEnvironments({
        values: { ...valid, DATABASE_URL: 'postgres://synthetic' },
        schema,
        destinationDirectory,
      }),
    /web.*DATABASE_URL/i,
  );
});

test('real production rejects an invalid SMTP host without exposing its value', () => {
  assert.throws(
    () =>
      validateEnvironment({
        values: { ...valid, SMTP_HOST: 'smtp.pending.invalid' },
        schema,
        deploymentClass: 'real-production',
      }),
    /SMTP_HOST/,
  );
});
```

Cover Caddy, payment-demo, worker, Postgres, Redis, unclassified keys, empty critical secrets, loopback origins, wildcard CORS, development defaults, missing release ID, and demo payment authority.

- [ ] **Step 2: Run the suite to verify it fails**

Run: node --test scripts/release/release-environment.test.mjs

Expected: FAIL because schema and renderer are absent.

- [ ] **Step 3: Derive the value-free registry**

Read key names from deploy/.env.production.example, packages/config/src/index.ts, apps/worker/src/worker-config.ts, apps/payment-demo/main.mjs, and Compose. Classify exact keys, consumers, and production rules.

- [ ] **Step 4: Implement validation, service rendering, and Compose changes**

Write only allowed keys to each service file. Restrict file permissions where supported. Report key names and counts only.

```yaml
env_file:
  - path: RELEASE_ENV_DIR/api.env
    required: true
```

Apply an equivalent explicit file for each canonical service and remove global shared secret inheritance.

- [ ] **Step 5: Verify and commit**

Run: node --test scripts/release/release-environment.test.mjs

Run: docker compose --env-file deploy/.env.production.example -f docker-compose.production.yml config --quiet

Expected: PASS using example values only.

Commit:

```bash
git add deploy/environment-schema.json docker-compose.production.yml scripts/release
git commit -m "feat: enforce per-service release environment allowlists"
```

### Task 4: Implement canonical topology checks and complete release attestation

**Files:**

- Create: scripts/release/lib/topology.mjs
- Create: scripts/release/lib/attestation.mjs
- Create: scripts/release/check-release-topology.mjs
- Create: scripts/release/attest-release.mjs
- Create: scripts/release/release-attestation.test.mjs

**Interfaces:**

- Produces validateTopology(input) and attestRelease(input).
- Runtime snapshots include only service state, image identity, labels, Compose ownership, and file paths.
- Attestation returns status PASS or FAIL with per-service checks and exits nonzero on FAIL.

- [ ] **Step 1: Write failing mixed-worker attestation test**

```js
test('worker digest mismatch fails attestation while other services match', () => {
  const report = attestRelease({
    manifest,
    releaseDirectory,
    runtimeSnapshot: mixedWorkerSnapshot,
    currentPointer,
  });
  assert.equal(report.status, 'FAIL');
  assert.equal(report.services.worker.match, false);
});
```

Add independent cases for missing canonical service, staging ownership, pointer mismatch, mutable app image, shared release mismatch, Compose mismatch, Caddy mismatch, unexpected service, and failed migration evidence.

- [ ] **Step 2: Run the suite to verify it fails**

Run: node --test scripts/release/release-attestation.test.mjs

Expected: FAIL because topology and attestation functions are absent.

- [ ] **Step 3: Implement topology, snapshot normalization, and CLI boundaries**

Canonical services are Caddy, web, payment-demo, API, worker, Postgres, and Redis. Migration completion is mandatory evidence. Support sanitized snapshot input and explicitly requested local Docker inspection. Reject known secret-bearing snapshot fields.

- [ ] **Step 4: Verify and commit**

Run: node --test scripts/release/release-attestation.test.mjs

Run: node scripts/release/check-release-topology.mjs --help

Run: node scripts/release/attest-release.mjs --help

Expected: PASS.

Commit:

```bash
git add scripts/release package.json
git commit -m "feat: attest complete release topology"
```

### Task 5: Implement governed deploy, rollback, and isolated failure rehearsal

**Files:**

- Create: scripts/release/lib/release-state.mjs
- Create: scripts/release/lib/preflight.mjs
- Create: scripts/release/deploy-release.mjs
- Create: scripts/release/rollback-release.mjs
- Create: scripts/release/rehearse-release.mjs
- Create: scripts/release/release-state.test.mjs
- Create: scripts/release/release-rehearsal.test.mjs

**Interfaces:**

- Produces planDeploy(input), planRollback(input), executeReleasePlan(plan, adapter), and rehearseRelease(input).
- Default command result is a dry-run plan.
- Isolated execution requires --execute --target isolated --target-root absolute-path.
- Production execution requires --execute --target production, --confirm-release exact-release-id, and a separately supplied authorization token.

- [ ] **Step 1: Write failing interruption test**

```js
test('interrupted candidate deployment leaves current pointer at release A', () => {
  const result = executeReleasePlan(
    planDeploy({ candidate: releaseB, previous: releaseA }),
    failingAdapter({ failAt: 'start-complete-set' }),
  );
  assert.equal(result.status, 'FAIL');
  assert.equal(
    readlinkSync(join(targetRoot, 'current')),
    join(targetRoot, 'releases', releaseA.releaseId),
  );
});
```

Cover missing image, tampered manifest, wrong Compose digest, startup failure, health failure, interruption, pointer-switch failure, mixed image, unknown current release, missing rollback manifest, and migration compatibility rejection.

- [ ] **Step 2: Run tests to verify failure**

Run: node --test scripts/release/release-state.test.mjs scripts/release/release-rehearsal.test.mjs

Expected: FAIL because planning and state functions are absent.

- [ ] **Step 3: Implement fail-closed preflight**

Check artifacts, image existence adapter, previous manifest, environment keys, backup evidence, migration compatibility, current attestation, disk/DNS prerequisites, and rollback candidate before execute behavior.

- [ ] **Step 4: Implement atomic target-root transitions**

Stage candidate artifacts in a sibling temporary directory, verify, atomically rename into releases/releaseId, start a complete candidate set through the adapter, attest, atomically switch current, attest again, and write redacted evidence. Failures restore only the known previous pointer and candidate resources.

- [ ] **Step 5: Implement complete-manifest rollback and rehearsal**

Reject partial, mutable, incompatible, and unknown state. Prove:

```text
release A deploy -> attest A -> release B deploy -> attest B -> rollback A -> attest A -> mixed worker image rejected
```

- [ ] **Step 6: Verify and commit**

Run: node --test scripts/release/release-state.test.mjs scripts/release/release-rehearsal.test.mjs

Run: node scripts/release/rehearse-release.mjs --target isolated

Expected: PASS with a temporary target root only.

Commit:

```bash
git add scripts/release package.json
git commit -m "feat: add governed release deploy and rollback tooling"
```

### Task 6: Record Wave 0/1 evidence and run fresh quality gates

**Files:**

- Create: docs/audit/WAVE1_CURRENT_RELEASE_PIPELINE.md
- Create: docs/stabilization/WAVE0_PRODUCTION_TRUTH.md
- Create: docs/stabilization/WAVE1_RELEASE_INTEGRITY_REPORT.md
- Create: docs/stabilization/PEACENEST_PRODUCTION_RELEASE_RECONCILIATION_PLAN.md
- Create: docs/stabilization/DEPENDENCY_SECURITY_TRIAGE.md
- Create: WAVE1_SUMMARY.txt

**Interfaces:**

- Consumes fresh command results, read-only production snapshot, CI evidence, release-tool result, and pnpm audit JSON.
- Produces evidence distinguishing live facts, local checks, hosted checks, inferred claims, and human-authorized future steps.

- [ ] **Step 1: Document production and pipeline facts**

Record all service identities, release-authority divergence, intended versus actual flow, rollback ambiguities, mutable-tag entry points, staging crossover, and tracked/untracked operational-script classification. Never copy values for secrets, PII, cookies, or tokens.

- [ ] **Step 2: Run fresh non-mutating gates**

Run: pnpm format:check

Run: pnpm lint

Run: pnpm typecheck

Run: pnpm test:unit

Run: pnpm db:check

Run: pnpm test:integration

Run: pnpm test:pricing

Run: pnpm test:availability

Run: pnpm test:quotes

Run: pnpm check:openapi

Run: pnpm check:release-integrity

Run: pnpm build

Run: pnpm audit:deps

Run: gitleaks detect --source . --no-git

Record command, exit code, pass count, fail count, and documented RM-504 dependency blocker status.

- [ ] **Step 3: Produce dependency triage and reconciliation plan**

Run: pnpm audit --prod --audit-level=high --json

For every high advisory, record package, dependency path, production reachability, class, patched candidate, blast radius, and RM-504 recommendation. Do not upgrade dependencies.

The reconciliation plan names current authorities, target release requirements, backup evidence, database compatibility, release order, canaries, rollback trigger/command, and removal of staging ownership, pointer divergence, mutable images, mixed revisions, and stale release metadata.

- [ ] **Step 4: Self-review safety and scope**

Run: rg -n 'TODO|TBD|latest|continue-on-error|allow_failure|\|\| true' .github deploy scripts/release docs/stabilization docs/audit WAVE1_SUMMARY.txt

Inspect every match. Retain only intentional rejection tests or explanatory documentation. Confirm no production host, container ID, secret, raw environment value, direct lifecycle SQL mutation, or production execute command appears in tested paths.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/audit docs/stabilization WAVE1_SUMMARY.txt
git commit -m "docs: record wave1 release integrity evidence"
```

### Task 7: Final review and non-deploying publication

**Files:**

- Verify: all files changed by Tasks 1 through 6

**Interfaces:**

- Consumes final gate results and GitHub access.
- Produces honest final status, commit list, pushed branch, and draft pull request when permissions permit.

- [ ] **Step 1: Rerun final gates after documentation**

Repeat the exact Task 6 commands. Treat unavailable, timed-out, skipped, or failed commands as non-pass.

- [ ] **Step 2: Review diff and history**

Run: git diff main...HEAD --check

Run: git log --oneline main..HEAD

Run: git status --short

Expected: no unintended files and no change outside Wave 0/1 scope.

- [ ] **Step 3: Push and create a draft pull request when permitted**

```bash
git push --set-upstream origin codex/stabilize-release-integrity
gh pr create --draft --base main --head codex/stabilize-release-integrity --title "Wave 1 release integrity foundation"
```

If GitHub denies either operation, retain local commits and report the non-secret permission failure.

- [ ] **Step 4: Report required final fields**

Report local and hosted CI separately, declare PRODUCTION_MUTATIONS_PERFORMED=NO, list any RM-504 dependency blocker, and finish with WAITING_FOR=HUMAN_REVIEW_AND_APPROVAL_OF_PRODUCTION_RELEASE_RECONCILIATION.
