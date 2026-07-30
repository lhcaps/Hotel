import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type OpenApiDocument = {
  readonly paths?: Record<string, Record<string, unknown>>;
};

const artifactPath = resolve(import.meta.dirname, '../../../docs/openapi/admin-v1.json');

async function loadArtifact(): Promise<OpenApiDocument> {
  return JSON.parse(await readFile(artifactPath, 'utf8')) as OpenApiDocument;
}

describe('admin-v1.json route coverage', () => {
  it('documents every admin-only path and excludes public/availability/quote paths', async () => {
    const doc = await loadArtifact();
    const paths = Object.keys(doc.paths ?? {});
    expect(paths).toContain('/api/v1/admin/me');
    expect(paths).toContain('/api/v1/admin/property');
    for (const path of paths) {
      expect(path, `admin artifact must not contain public route ${path}`).not.toMatch(
        /^\/api\/v1\/public\//,
      );
      expect(path, `admin artifact must not contain availability route ${path}`).not.toMatch(
        /^\/api\/v1\/availability\//,
      );
      expect(path, `admin artifact must not contain quote route ${path}`).not.toMatch(
        /^\/api\/v1\/quotes(\/|$)/,
      );
    }
  });
});
