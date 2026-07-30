import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const artifactPath = resolve(import.meta.dirname, '../../../docs/openapi/public-v1.json');

async function loadArtifact(): Promise<unknown> {
  return JSON.parse(await readFile(artifactPath, 'utf8')) as unknown;
}

function collectFieldNames(value: unknown, acc: Set<string>): void {
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectFieldNames(entry, acc));
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.name === 'string') acc.add(record.name);
  if (typeof record.$ref === 'string') acc.add(record.$ref);
  for (const child of Object.values(record)) collectFieldNames(child, acc);
}

const FORBIDDEN = ['sessionToken', 'session_token', 'rawToken'];

describe('public-v1.json never exposes raw session tokens in JSON shapes', () => {
  it('does not declare a session token field in any schema', async () => {
    const doc = await loadArtifact();
    const fields = new Set<string>();
    collectFieldNames(doc, fields);
    for (const forbidden of FORBIDDEN) {
      expect(fields.has(forbidden), `${forbidden} must not appear`).toBe(false);
    }
  });
});
