import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const targetFiles = [
  'test/booking-authority-fields.test.ts',
  'test/quote-booking-price-contract.test.ts',
  'test/openapi-public-routes.test.ts',
  'test/openapi-admin-routes.test.ts',
  'test/booking-detail-cookie-auth.test.ts',
  'test/no-session-token-in-responses.test.ts',
  'test/hold-request-authority-fields.test.ts',
  'test/otp-schema-match.test.ts',
  'test/error-codes.test.ts',
  'test/openapi-unique-operation-ids.test.ts',
  'test/openapi-reproducibility.test.ts',
];

const FORBIDDEN_PATTERNS = [
  /\.todo\s*\(/,
  /\.skip\s*\(/,
  /\bxit\s*\(/,
  /\bxdescribe\s*\(/,
  /\bfdescribe\s*\(/,
  /\/\/\s*TODO\b/,
  /\/\/\s*FIXME\b/,
];

describe('Task 9 test files contain no skip or todo markers', () => {
  for (const relativePath of targetFiles) {
    it(`${relativePath} contains no skip/todo markers`, async () => {
      const absolute = resolve(import.meta.dirname, '..', relativePath);
      const stats = await stat(absolute);
      if (!stats.isFile()) throw new Error(`${relativePath} is not a file`);
      const content = await readFile(absolute, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(
          pattern.test(content),
          `${relativePath} contains forbidden marker ${pattern.toString()}`,
        ).toBe(false);
      }
    });
  }

  it('every file referenced by Task 9 plan exists on disk', async () => {
    const testDir = resolve(import.meta.dirname, '..', 'test');
    const entries = await readdir(testDir);
    for (const relativePath of targetFiles) {
      const name = relativePath.replace(/^test\//, '');
      expect(entries, `${relativePath} must exist`).toContain(name);
    }
  });
});
