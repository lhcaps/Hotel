import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type OpenApiDocument = {
  readonly paths?: Record<string, Record<string, Record<string, unknown>>>;
  readonly components?: { readonly securitySchemes?: Record<string, Record<string, unknown>> };
};

const artifactPath = resolve(import.meta.dirname, '../../../docs/openapi/public-v1.json');

async function loadArtifact(): Promise<OpenApiDocument> {
  return JSON.parse(await readFile(artifactPath, 'utf8')) as OpenApiDocument;
}

describe('public booking-detail cookie auth documentation', () => {
  it('declares a cookieAuth security scheme named rm_guest_session_v1', async () => {
    const doc = await loadArtifact();
    const cookieAuth = doc.components?.securitySchemes?.cookieAuth as
      { type?: string; in?: string; name?: string } | undefined;
    expect(cookieAuth?.type).toBe('apiKey');
    expect(cookieAuth?.in).toBe('cookie');
    expect(cookieAuth?.name).toBe('rm_guest_session_v1');
  });

  it('references cookieAuth on GET /api/v1/public/bookings/{bookingCode}', async () => {
    const doc = await loadArtifact();
    const op = doc.paths?.['/api/v1/public/bookings/{bookingCode}']?.get as
      { security?: ReadonlyArray<Record<string, string[]>> } | undefined;
    expect(op?.security?.some((scheme) => 'cookieAuth' in scheme)).toBe(true);
  });

  it('does not reference admin-only authentication responses', async () => {
    const doc = await loadArtifact();
    const op = doc.paths?.['/api/v1/public/bookings/{bookingCode}']?.get as
      { responses?: Record<string, unknown> } | undefined;
    const responses = op?.responses ?? {};
    for (const [status, response] of Object.entries(responses)) {
      if (status === '401') {
        const ref = (response as { $ref?: string }).$ref;
        expect(ref).toBe('#/components/responses/GuestSessionRequired');
      } else {
        const ref = (response as { $ref?: string }).$ref;
        expect(ref).not.toBe('#/components/responses/AuthenticationRequired');
        expect(ref).not.toBe('#/components/responses/PermissionDenied');
      }
    }
  });
});
