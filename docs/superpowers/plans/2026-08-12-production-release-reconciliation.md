# Production Release Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a fail-closed production deployment class to the existing immutable release system, bootstrap a non-canonical recovery baseline for the mixed legacy runtime, and cut over only after backup, migration, rollback, and attestation evidence pass.

**Architecture:** Production extends the manifest, environment-schema, topology, attestation, and release-state modules already used for isolated releases. New pure policy functions validate SHA-bound approval, recovery-baseline, backup, and restore-rehearsal evidence before either deploy or rollback can mutate. Release source is materialized only from the approved committed Git object.

**Tech Stack:** Node.js ESM, Node test runner, Docker Compose, SSH, PostgreSQL dump/restore, Git archive.

## Global Constraints

- Use only D:\Study\Project\Room Management on main; do not create worktrees, clones, or branches.
- Preserve historical untracked/operator artifacts and never stage them.
- Release content comes only from a committed Git object; no working-tree overlay is allowed.
- Production execute requires explicit target, execute, non-secret approval, recovery baseline, backup, restore, and rollback evidence.
- Never print credentials, environment values, tokens, cookies, OTPs, or payment secrets.
- Production changes use a complete Compose topology and never replace one service by itself.

---

### Task 1: Reconcile the stale tracked matrix

**Files:**

- Modify: docs/stabilization/ORIGINAL_REQUIREMENTS_GAP_MATRIX.md by restoring only its uncommitted overlay
- Create: this plan

**Interfaces:**

- Consumes: the current matrix diff, the 50-row denominator, and approved 49/50 source baseline.
- Produces: a clean tracked baseline before release materialization.

- [x] **Step 1: Record why the overlay is stale**

The overlay declares 50 atomic requirements but totals IMPLEMENTED=45 and PARTIAL=1. It also conflicts with the explicit current verified 49/50 result. Therefore it is stale local residue, not a truthful final reconciliation.

- [x] **Step 2: Restore only that path**

  git restore --source=HEAD -- docs/stabilization/ORIGINAL_REQUIREMENTS_GAP_MATRIX.md
  git diff --exit-code -- docs/stabilization/ORIGINAL_REQUIREMENTS_GAP_MATRIX.md

Expected: the tracked overlay is gone and all historical untracked artifacts remain unchanged.

### Task 2: Add a pure production evidence policy with RED-GREEN tests

**Files:**

- Create: scripts/release/lib/production-policy.mjs
- Create: scripts/release/production-policy.test.mjs

**Interfaces:**

- Consumes: manifest, approval JSON, recovery-baseline JSON, backup JSON, restore-rehearsal JSON.
- Produces: validateProductionApproval, validateRecoveryBaseline, validateBackupEvidence, validateRestoreRehearsal, and productionPreflightChecks.

- [x] **Step 1: Write failing tests**

  test('production approval binds target and exact manifest SHA', () => {
  assert.throws(() => validateProductionApproval({ approval: wrongSha, manifest, expectedApprovalId }), /source SHA/i);
  });
  test('mixed legacy truth is non-canonical recovery evidence', () => {
  assert.throws(() => validateRecoveryBaseline({ ...baseline, canonical: true }), /canonical=false/i);
  });

- [x] **Step 2: Verify RED**

  node --test scripts/release/production-policy.test.mjs

Expected: the test fails because the policy module and exports do not exist.

- [x] **Step 3: Implement the minimal policy**

Approval requires the fixed approval ID, target=production, scope OPERATIONS_V3_PRODUCTION_RELEASE_RECONCILIATION_AND_CANARY, ISO date, and a source SHA equal to manifest.sourceSha. Recovery baseline requires canonical=false, mixed=true, current pointer, images, revision labels, Compose/Caddy identity, migration state, environment hashes, restarts, database identity, and timestamp. Backup requires nonzero size, checksum, verification, database identity, and a restore-rehearsal reference. Values must be validation-only metadata.

- [x] **Step 4: Verify GREEN**

  node --test scripts/release/production-policy.test.mjs

Expected: all fail-closed cases pass without exposing sensitive values.

### Task 3: Extend deploy and rollback without changing isolated semantics

**Files:**

- Modify: scripts/release/deploy-release.mjs
- Modify: scripts/release/rollback-release.mjs
- Modify: scripts/release/lib/release-state.mjs
- Modify: scripts/release/lib/environment.mjs
- Modify: docker-compose.production.yml
- Create: scripts/release/production-release-cli.test.mjs
- Modify: scripts/release/release-state.test.mjs

**Interfaces:**

- Consumes: target isolated or production. Production additionally consumes approval, recovery-baseline, backup, restore-rehearsal, and explicit approval-ID files.
- Produces: named preflight failures and mutation only after every production check is true.

- [x] **Step 1: Write failing CLI tests**

  test('production dry-run without approval creates no candidate', () => {
  const result = runDeploy(['--target', 'production', '--dry-run']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /PREFLIGHT_FAILURE=approval/);
  assert.equal(existsSync(candidateDirectory), false);
  });
  test('isolated target remains accepted', () => {
  assert.equal(runDeploy(validIsolatedArgs).status, 0);
  });

- [x] **Step 2: Verify RED**

  node --test scripts/release/production-release-cli.test.mjs

Expected: production is rejected before the feature exists.

- [x] **Step 3: Implement named production checks**

Production validates approval, recovery baseline, backup, restore evidence, database health, Docker health, current truth, rollback target, migration provenance, disk, topology, manifest, source SHA, immutable images, Compose, Caddy, environment schema, required keys, and allowlists. It uses real-production environment validation. Dry-run performs no copy, Compose up, pointer write, migration, or restore.

Compose labels bind every service to release ID, source SHA, working directory, intended current pointer, Compose hash, Caddy hash, and migration-completed state so strict attestation can reject a mixed runtime.

- [x] **Step 4: Verify GREEN**

  node --test scripts/release/release-state.test.mjs scripts/release/production-release-cli.test.mjs

Expected: every missing mandatory production condition fails before mutation; isolated behavior remains green.

### Task 4: Capture an explicit mixed recovery baseline and materialize committed source

**Files:**

- Create: scripts/release/capture-recovery-baseline.mjs
- Create: scripts/release/materialize-release-from-git.mjs
- Create: scripts/release/recovery-baseline.test.mjs
- Modify: scripts/release/release-manifest.test.mjs

**Interfaces:**

- Consumes: Docker metadata and a full committed SHA.
- Produces: recovery baseline with canonical=false and mixed=true; a release directory built from a Git archive only.

- [x] **Step 1: Write failing tests**

  test('baseline rejects missing image IDs or environment hashes', () => {
  assert.throws(() => createRecoveryBaseline({ ...snapshot, images: {} }), /image/i);
  });
  test('archive materialization excludes untracked overlays', () => {
  materializeRelease({ sourceSha, repositoryRoot, destination });
  assert.equal(readFileSync(join(destination, 'tracked.txt'), 'utf8'), 'committed\n');
  assert.equal(existsSync(join(destination, 'untracked.txt')), false);
  });

- [x] **Step 2: Verify RED**

  node --test scripts/release/recovery-baseline.test.mjs

Expected: missing capture/materialization code makes the tests fail.

- [x] **Step 3: Implement constrained capture and archive materialization**

Capture Docker metadata, labels, health/restarts, file paths, and hashes only; never serialize environment values. Baseline files use mode 0600. Materialization verifies a full commit with git rev-parse, uses git archive into a new directory, excludes every modified or untracked overlay by construction, and records the resolved tree identity.

- [x] **Step 4: Verify GREEN**

  node --test scripts/release/recovery-baseline.test.mjs scripts/release/release-manifest.test.mjs

Expected: noncanonical recovery evidence and exact committed source semantics are proven.

### Task 5: Prove rollback strategy in a disposable recovery rehearsal

**Files:**

- Create: scripts/release/rehearse-production-recovery.mjs
- Create: scripts/release/production-recovery-rehearsal.test.mjs
- Modify: scripts/release/rehearse-release.mjs

**Interfaces:**

- Consumes: legacy application image, candidate migration image, disposable PostgreSQL volume, and backup evidence.
- Produces: application-compatible or database-restore-required rollback strategy plus validated restore evidence.

- [x] **Step 1: Write a failing strategy test**

  test('incompatible legacy runtime requires restore evidence', () => {
  const result = evaluateRollbackStrategy({ legacyCompatibility: false, restoreEvidence: undefined });
  assert.equal(result.ok, false);
  assert.equal(result.strategy, 'database-restore-required');
  });

- [x] **Step 2: Verify RED**

  node --test scripts/release/production-recovery-rehearsal.test.mjs

Expected: rollback strategy has not been implemented.

- [x] **Step 3: Implement the disposable rehearsal**

Start a disposable PostgreSQL instance, apply candidate migrations through the compiled migration entrypoint, start the legacy app revision against it, and record no more than pass/fail/version metadata. If compatibility fails, dump a disposable pre-migration database, verify size and checksum, restore only to a disposable database, and prove journal/provenance plus legacy health.

- [x] **Step 4: Verify GREEN**

  node --test scripts/release/production-recovery-rehearsal.test.mjs
  node scripts/release/rehearse-production-recovery.mjs

Expected: a single explicit rollback strategy and required restore proof are produced.

### Task 6: Full gates, exact-SHA CI, and authorized production operation

**Files:**

- Modify: exact release implementation/test files from Tasks 2 through 5
- Create outside the repository: approval, recovery baseline, backup, restore evidence, and candidate release artifacts

**Interfaces:**

- Consumes: exact committed final SHA with hosted CI success.
- Produces: one canonical production release, strict attestation, bounded Demo canary, and executable rollback evidence.

- [ ] **Step 1: Run all mandatory engineering gates**

Run frozen install, formatting, lint, typecheck, unit/catalog/auth/pricing/availability/quote/DB suites, OpenAPI, dependency audit, Gitleaks, build, release integrity, Storybook, web unit, E2E, production release tests, and recovery rehearsal. Record each exit independently.

- [ ] **Step 2: Commit and push exact paths**

  git add scripts/release/lib/production-policy.mjs scripts/release/lib/production-runtime.mjs scripts/release/capture-recovery-baseline.mjs scripts/release/materialize-release-from-git.mjs scripts/release/rehearse-production-recovery.mjs scripts/release/deploy-release.mjs scripts/release/rollback-release.mjs scripts/release/lib/release-state.mjs scripts/release/lib/environment.mjs docker-compose.production.yml scripts/release/production-policy.test.mjs scripts/release/production-release-cli.test.mjs scripts/release/recovery-baseline.test.mjs scripts/release/production-recovery-rehearsal.test.mjs scripts/release/release-state.test.mjs scripts/release/release-manifest.test.mjs scripts/release/rehearse-release.mjs docs/superpowers/plans/2026-08-12-production-release-reconciliation.md
  git commit -m "feat(release): add governed production reconciliation"
  git push origin main

Before staging, remove any path from this list that was not changed and retain all historical untracked artifacts unstaged.

- [ ] **Step 3: Require exact-SHA hosted CI**

Wait for the GitHub workflow for the pushed HEAD. No deployment starts while a required job is pending, skipped, or failing.

- [ ] **Step 4: Run the governed sequence**

On peacenest: capture current truth; capture a recovery baseline; create and verify a backup and isolated restore rehearsal; materialize the exact final Git archive; build digest-bound images; generate manifest and service environments; run production deploy and rollback dry-runs; execute the complete production topology; apply only canonical migrations; switch current after health; strictly attest; run safe web smoke and the smallest Demo-payment booking/cancellation canary.

- [ ] **Step 5: Roll back on mandatory acceptance failure**

Use only the explicit production rollback command and the proven strategy. Never patch files, run direct SQL, or restart individual services.
