import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const adminArtifactPath = resolve(import.meta.dirname, '../../../docs/openapi/admin-v1.json');
const publicArtifactPath = resolve(import.meta.dirname, '../../../docs/openapi/public-v1.json');

type OpenApiDocument = {
  readonly paths?: Record<string, Record<string, Record<string, unknown>>>;
};

function collectIds(doc: OpenApiDocument): Map<string, string> {
  const ids = new Map<string, string>();
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const id = (operation as { operationId?: unknown }).operationId;
      if (typeof id === 'string') ids.set(id, `${method.toUpperCase()} ${path}`);
    }
  }
  return ids;
}

describe('OpenAPI operation ID uniqueness', () => {
  it('admin-v1.json operation IDs are unique within the artifact', async () => {
    const doc = JSON.parse(await readFile(adminArtifactPath, 'utf8')) as OpenApiDocument;
    const ids = collectIds(doc);
    const seen = new Set<string>();
    for (const id of ids.keys()) {
      expect(seen.has(id), `duplicate admin operationId: ${id}`).toBe(false);
      seen.add(id);
    }
  });

  it('public-v1.json operation IDs are unique within the artifact', async () => {
    const doc = JSON.parse(await readFile(publicArtifactPath, 'utf8')) as OpenApiDocument;
    const ids = collectIds(doc);
    const seen = new Set<string>();
    for (const id of ids.keys()) {
      expect(seen.has(id), `duplicate public operationId: ${id}`).toBe(false);
      seen.add(id);
    }
  });

  it('admin and public artifacts do not share any operationId', async () => {
    const admin = JSON.parse(await readFile(adminArtifactPath, 'utf8')) as OpenApiDocument;
    const publicDoc = JSON.parse(await readFile(publicArtifactPath, 'utf8')) as OpenApiDocument;
    const adminIds = collectIds(admin);
    const publicIds = collectIds(publicDoc);
    for (const id of adminIds.keys()) {
      expect(publicIds.has(id), `operationId "${id}" appears in both artifacts`).toBe(false);
    }
  });
});
