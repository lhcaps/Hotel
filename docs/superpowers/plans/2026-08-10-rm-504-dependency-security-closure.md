# RM-504 Dependency Security Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every high- and critical-severity production dependency finding without changing product behavior or touching production.

**Architecture:** Preserve the current Fastify, Better Auth, Next, and shadcn major versions. Use patch-level `pnpm` overrides only where the declaring parent accepts the patched version, and move the unused shadcn CLI from the web runtime graph to the web development graph. A release-integrity test will lock those constraints so a future manifest edit cannot reintroduce the vulnerable production graph.

**Tech Stack:** pnpm 10 workspaces, Node 24, Fastify 5, Next 16, Docker multi-stage builds, Node test runner, GitHub Actions.

## Global Constraints

- Do not deploy, merge, reconcile `/current`, or mutate production.
- Do not suppress, ignore, or downgrade audit findings.
- Keep `TARGET_SOURCE_SHA=FINAL_APPROVED_RELEASE_SHA` and leave `FINAL_APPROVED_RELEASE_SHA=NOT_APPROVED`.
- Patch only advisory floors: fast-uri 3.1.5, fast-uri 4.1.2, undici 7.29.0, brace-expansion 5.0.9, js-yaml 4.3.1, and nanoid 3.3.17.
- Do not add a major dependency upgrade or move a runtime import to devDependencies.

---

### Task 1: Lock the intended production dependency closure

**Files:**
- Create: `scripts/release/production-dependency-closure.test.mjs`

**Interfaces:**
- Consumes: root `package.json` and `apps/web/package.json` manifests.
- Produces: a Node test executed by `pnpm test:release-integrity`.

- [ ] **Step 1: Write the failing test**

```js
assert.equal(root.pnpm.overrides['fast-uri@3'], '3.1.5');
assert.equal(root.pnpm.overrides['fast-uri@4'], '4.1.2');
assert.equal(root.pnpm.overrides.undici, '7.29.0');
assert.equal(root.pnpm.overrides['brace-expansion'], '5.0.9');
assert.equal(root.pnpm.overrides['js-yaml'], '4.3.1');
assert.equal(root.pnpm.overrides.nanoid, '3.3.17');
assert.equal(web.dependencies?.shadcn, undefined);
assert.equal(web.devDependencies.shadcn, '4.16.0');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/release/production-dependency-closure.test.mjs`

Expected: FAIL because the patch overrides are absent and `shadcn` is in `apps/web` production dependencies.

- [ ] **Step 3: Confirm release-integrity auto-discovers the regression**

Run: `node scripts/release/run-tests.mjs`

Expected: `scripts/release/run-tests.mjs` discovers every `*.test.mjs` file in its directory, including `production-dependency-closure.test.mjs`, so hosted `check:release-integrity` executes it after the dependency audit passes.

- [ ] **Step 4: Re-run the failing test**

Run: `node --test scripts/release/production-dependency-closure.test.mjs`

Expected: FAIL until the manifest and lockfile change in Task 2.

### Task 2: Apply the smallest compatible dependency graph change

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Fastify parents declaring `fast-uri` ranges `^3.0.0` and `^4.0.0`, jsdom declaring `undici ^7.25.0`, cosmiconfig declaring `js-yaml ^4.1.0`, and PostCSS declaring `nanoid ^3.3.16`.
- Produces: a production lockfile whose high/critical audit count is zero.

- [ ] **Step 1: Add only compatible patch overrides**

```json
{
  "pnpm": {
    "overrides": {
      "fast-uri@3": "3.1.5",
      "fast-uri@4": "4.1.2",
      "undici": "7.29.0",
      "brace-expansion": "5.0.9",
      "js-yaml": "4.3.1",
      "nanoid": "3.3.17"
    }
  }
}
```

- [ ] **Step 2: Reclassify the unused shadcn CLI**

Move the exact `shadcn: "4.16.0"` declaration from `apps/web/package.json` `dependencies` to `devDependencies`; no source module imports `shadcn`.

- [ ] **Step 3: Regenerate, never hand-edit, the lockfile**

Run: `pnpm install --lockfile-only`

Expected: only affected patched transitive packages and the web shadcn dependency edge change; no direct major package upgrade.

- [ ] **Step 4: Verify the regression turns green**

Run: `node --test scripts/release/production-dependency-closure.test.mjs`

Expected: PASS.

### Task 3: Prove production-image closure and runtime behavior

**Files:**
- Modify: `docs/stabilization/DEPENDENCY_SECURITY_TRIAGE.md`

**Interfaces:**
- Consumes: the final Dockerfile runtime stage and the candidate dependency graph.
- Produces: per-advisory image-presence and runtime-reachability evidence.

- [ ] **Step 1: Build a local runtime candidate**

Run: `docker build --target runtime --tag room-rm504-candidate:<HEAD> --build-arg RELEASE_SHA=<HEAD> .`

Expected: PASS; this is a local image only.

- [ ] **Step 2: Resolve advisories from their actual runtime parents**

Run Node resolution probes from Fastify, `@fastify/ajv-compiler`, `fast-json-stringify`, Better Auth, Vitest, jsdom, shadcn, cosmiconfig, ts-morph, and Next in the final image.

Expected: no vulnerable version remains; API Fastify paths resolve patched fast-uri versions; API, web, worker, and payment-demo entrypoints do not resolve a vulnerable advisory package.

- [ ] **Step 3: Run behavior regressions**

Run: `pnpm test:catalog`, `pnpm test:auth`, `pnpm check:openapi`, `pnpm build`, and `pnpm test:release-integrity`.

Expected: all pass without business-logic changes.

### Task 4: Refresh security records and complete local gates

**Files:**
- Modify: `docs/stabilization/DEPENDENCY_SECURITY_TRIAGE.md`
- Modify: `docs/stabilization/WAVE1_RELEASE_INTEGRITY_REPORT.md`
- Modify: `WAVE1_SUMMARY.txt`

**Interfaces:**
- Consumes: fresh audit, image inspection, lockfile diff, and full local command results.
- Produces: a release record that distinguishes engineering readiness from production reconciliation.

- [ ] **Step 1: Run the mandatory fresh audit**

Run: `pnpm audit --prod --audit-level=high --json`

Expected: exit 0, high 0, critical 0.

- [ ] **Step 2: Run every local mandatory gate**

Run: format, lint, typecheck, unit, catalog, auth, pricing, availability, quotes, OpenAPI, db:check, db:test, Gitleaks, build, release-integrity, Storybook, web unit, Playwright installation, and E2E.

Expected: each command exits 0; no result is inherited from a prior commit.

- [ ] **Step 3: Document the exact remediation**

Record original and final versions, parent ranges, override safety, final image reachability, lockfile blast radius, command outcomes, and `PRODUCTION_RECONCILIATION_EXECUTED=NO`.

### Task 5: Push and close the hosted evidence loop

**Files:**
- Modify: only files completed in Tasks 1-4.

**Interfaces:**
- Consumes: current draft PR #10.
- Produces: one normal fast-forward push to `codex/stabilize-release-integrity`.

- [ ] **Step 1: Commit focused security changes**

Run: `git add <security files> && git commit -m "fix(security): close production dependency audit"`

- [ ] **Step 2: Push without force**

Run: `git push origin codex/stabilize-release-integrity`

- [ ] **Step 3: Monitor the replacement hosted run through its final mandatory step**

Expected: audit, secret scan, build, release-integrity, Storybook, web unit, Playwright installation, and E2E all execute and pass; the PR stays draft and no production operation occurs.
