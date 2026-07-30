#!/usr/bin/env node
// scripts/demo/lifecycle.test.mjs
//
// Phase 6F demo lifecycle unit tests. Pure logic; no Docker, no
// Postgres, no API server. We exercise:
//
//   1. assertSafeDemoDatabaseUrl: rejects persistent names, refuses
//      non-loopback hosts, refuses query/hash, validates prefix.
//   2. DEMO_DATABASE_NAME_PATTERN: validates the disposable prefix.
//   3. Real TCP bind detection: a non-HTTP listener on a chosen port
//      must be detected before startup.
//   4. Manifest parsing: returns null on missing file or invalid JSON.
//   5. Password basename regex: matches valid basenames and rejects
//      short/uppercase hex suffixes.

import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

import {
  DEMO_API_PORT,
  DEMO_DATABASE_NAME_PATTERN,
  DEMO_MANIFEST_SCHEMA,
  DEMO_WEB_PORT,
  assertSafeDemoDatabaseUrl,
} from './demo-constants.mjs';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} ${detail ?? ''}\n`);
}

function expectThrow(fn, pattern) {
  try {
    fn();
    return { ok: false, message: 'expected throw' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (pattern.test(message)) return { ok: true, message };
    return { ok: false, message: `message did not match ${pattern}: ${message}` };
  }
}

// 1. assertSafeDemoDatabaseUrl.
record(
  'safeDbUrl.rejects.persistent',
  expectThrow(
    () => assertSafeDemoDatabaseUrl('postgresql://room:room@127.0.0.1:5432/room_management'),
    /persistent\/shared|Demo runner refused database name/,
  ).ok,
  'refuses room_management',
);
record(
  'safeDbUrl.rejects.non-loopback',
  expectThrow(
    () => assertSafeDemoDatabaseUrl('postgresql://room:room@db.internal/room_management_demo_abc'),
    /non-loopback/,
  ).ok,
  'refuses non-loopback host',
);
record(
  'safeDbUrl.rejects.bad-prefix',
  expectThrow(
    () => assertSafeDemoDatabaseUrl('postgresql://room:room@127.0.0.1:5432/prod_db'),
    /Demo runner refused database name/,
  ).ok,
  'refuses non-prefixed name',
);
record(
  'safeDbUrl.rejects.query',
  expectThrow(
    () =>
      assertSafeDemoDatabaseUrl(
        'postgresql://room:room@127.0.0.1:5432/room_management_demo_abc?sslmode=require',
      ),
    /query\/hash/,
  ).ok,
  'refuses query overrides',
);
record(
  'safeDbUrl.accepts.demo',
  (() => {
    try {
      assertSafeDemoDatabaseUrl('postgresql://room:room@127.0.0.1:5432/room_management_demo_abc');
      return true;
    } catch {
      return false;
    }
  })(),
  'accepts room_management_demo_abc',
);

// 2. DEMO_DATABASE_NAME_PATTERN.
record(
  'pattern.rejects.dash-prefix',
  !DEMO_DATABASE_NAME_PATTERN.test('-room_management_demo_abc'),
  'must start with letter/digit after prefix',
);
record(
  'pattern.accepts.base64url',
  DEMO_DATABASE_NAME_PATTERN.test('room_management_demo_AbCdEf_-0123'),
  'base64url alphabet is allowed',
);

// 3. Real TCP bind detection (Stage E).
function bindProbe(port) {
  return new Promise((resolveProbe) => {
    const server = createServer();
    server.unref();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      server.close(() => resolveProbe(result));
    };
    server.once('error', (error) => {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      finish({ free: false, code });
    });
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => finish({ free: true }));
  });
}

async function runPortCollisionTest(port) {
  // Reserve the port with a long-lived TCP server that does NOT
  // speak HTTP. Then assert a fresh bind on the same port fails
  // with EADDRINUSE.
  const holder = createServer();
  await new Promise((res, rej) => {
    holder.once('error', rej);
    holder.listen({ host: '127.0.0.1', port }, res);
  });
  try {
    return await bindProbe(port);
  } finally {
    await new Promise((res) => holder.close(res));
  }
}

const TEST_PORT = 39100;
const collision = await runPortCollisionTest(TEST_PORT);
record(
  'tcpBind.detects.collision',
  !collision.free && collision.code === 'EADDRINUSE',
  `non-HTTP listener on ${TEST_PORT} detected with code=${String(collision.code)}`,
);

// Sanity probe against the real demo ports.
const freeWeb = await bindProbe(DEMO_WEB_PORT);
const freeApi = await bindProbe(DEMO_API_PORT);
record(
  'tcpBind.reports.free.web',
  freeWeb.free,
  `web ${DEMO_WEB_PORT} reported ${freeWeb.free ? 'free' : `busy code=${String(freeWeb.code)}`}`,
);
record(
  'tcpBind.reports.free.api',
  freeApi.free,
  `api ${DEMO_API_PORT} reported ${freeApi.free ? 'free' : `busy code=${String(freeApi.code)}`}`,
);

// 4. Manifest parsing.
const tmp = mkdtempSync(join(tmpdir(), 'demo-lifecycle-test-'));
const goodManifest = join(tmp, 'good.json');
const badManifest = join(tmp, 'bad.json');

writeFileSync(
  goodManifest,
  JSON.stringify({
    schema: DEMO_MANIFEST_SCHEMA,
    databaseName: 'room_management_demo_abcdef',
    passwordPath: join(tmpdir(), 'room-management-demo-admin-0123abcd4567ef89.txt'),
    webPort: DEMO_WEB_PORT,
    apiPort: DEMO_API_PORT,
  }),
);

function parseManifest(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

record(
  'manifest.parses.good',
  (() => {
    const m = parseManifest(goodManifest);
    return m !== null && m.databaseName === 'room_management_demo_abcdef';
  })(),
  'parses a valid manifest',
);
writeFileSync(badManifest, '{not-json');
record('manifest.parses.bad', parseManifest(badManifest) === null, 'returns null on invalid JSON');
record(
  'manifest.missing.null',
  parseManifest(join(tmp, 'missing.json')) === null,
  'returns null on missing file',
);

// 5. Password basename pattern (mirrors the regex used by both
//    smoke.mjs and lifecycle-test.mjs). The actual filename is
//    `randomBytes(8).toString('hex')` -> 16 lowercase hex chars.
const PASSWORD_PATTERN = /^room-management-demo-admin-[a-f0-9]{16}\.txt$/;
record(
  'passwordBasename.matches',
  PASSWORD_PATTERN.test('room-management-demo-admin-deadbeefcafe1234.txt'),
  'matches valid password basename (16 hex chars)',
);
record(
  'passwordBasename.rejects.upper',
  !PASSWORD_PATTERN.test('room-management-demo-admin-DEADBEEFCAFE1234.txt'),
  'rejects uppercase hex',
);
record(
  'passwordBasename.rejects.short',
  !PASSWORD_PATTERN.test('room-management-demo-admin-abc.txt'),
  'rejects too-short hex (less than 16 chars)',
);

const failed = results.filter((r) => !r.ok);
process.stdout.write(
  `\nLifecycle unit tests: ${results.length - failed.length}/${results.length} passed\n`,
);
if (failed.length > 0) {
  process.stdout.write(`  failed: ${failed.map((r) => r.name).join(', ')}\n`);
  process.exitCode = 1;
}
