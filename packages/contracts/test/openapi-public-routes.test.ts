import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type OpenApiDocument = {
  readonly paths?: Record<string, Record<string, unknown>>;
  readonly components?: { readonly responses?: Record<string, Record<string, unknown>> };
};

const artifactPath = resolve(import.meta.dirname, '../../../docs/openapi/public-v1.json');

async function loadArtifact(): Promise<OpenApiDocument> {
  return JSON.parse(await readFile(artifactPath, 'utf8')) as OpenApiDocument;
}

const EXPECTED_PATHS = [
  '/api/v1/public/room-types',
  '/api/v1/availability/search',
  '/api/v1/quotes',
  '/api/v1/quotes/{id}',
  '/api/v1/public/quotes/{quoteId}/bookings',
  '/api/v1/public/guest-access/otp/request',
  '/api/v1/public/guest-access/otp/verify',
  '/api/v1/public/bookings/{bookingCode}',
  '/api/v1/public/bookings/{bookingCode}/access-pass',
  '/api/v1/public/bookings/{bookingCode}/payments/momo/attempts',
  '/api/v1/webhooks/momo',
  '/api/v1/payments/providers/momo/return',
  '/api/v1/public/booking-holds/status',
  '/api/v1/public/guest-access/logout',
];

const FORBIDDEN_FALLBACK_PATHS = [
  '/api/v1/guest-access/otp/request',
  '/api/v1/guest-access/otp/verify',
  '/api/v1/guest-access/logout',
  '/api/v1/booking-holds/status',
  '/api/v1/public/bookings',
];

describe('public-v1.json route coverage', () => {
  it('documents every Phase 5 + Phase 4 public path exactly once', async () => {
    const doc = await loadArtifact();
    const paths = doc.paths ?? {};
    for (const path of EXPECTED_PATHS) {
      expect(paths[path], `missing path ${path}`).toBeDefined();
    }
  });

  it('does not document legacy fallback paths without the public/ prefix', async () => {
    const doc = await loadArtifact();
    const paths = Object.keys(doc.paths ?? {});
    for (const forbidden of FORBIDDEN_FALLBACK_PATHS) {
      expect(paths, `must not contain legacy ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('does not document any admin paths', async () => {
    const doc = await loadArtifact();
    const paths = Object.keys(doc.paths ?? {});
    for (const path of paths) {
      expect(path, `public artifact must not contain admin path ${path}`).not.toMatch(
        /^\/api\/v1\/admin\//,
      );
    }
  });

  it('references the cookieAuth security scheme on the booking-detail route', async () => {
    const doc = await loadArtifact();
    const op = (doc.paths?.['/api/v1/public/bookings/{bookingCode}']?.get ?? {}) as {
      security?: ReadonlyArray<Record<string, string[]>>;
    };
    expect(op.security?.some((scheme) => 'cookieAuth' in scheme)).toBe(true);
  });

  it('documents the guest-authorized booking access pass as a conflict-safe QR response', async () => {
    const doc = await loadArtifact();
    const operation = doc.paths?.['/api/v1/public/bookings/{bookingCode}/access-pass']?.get as
      | {
          security?: ReadonlyArray<Record<string, string[]>>;
          responses?: Record<string, { $ref?: string }>;
        }
      | undefined;
    expect(operation?.security?.some((scheme) => 'cookieAuth' in scheme)).toBe(true);
    expect(operation?.responses?.['409']?.$ref).toBe(
      '#/components/responses/BookingAccessPassInvalid',
    );
  });

  it('documents the Phase 7D MoMo initiation as booking-scoped and keeps its IPN unauthenticated', async () => {
    const doc = await loadArtifact();
    const initiation = doc.paths?.['/api/v1/public/bookings/{bookingCode}/payments/momo/attempts']
      ?.post as { security?: ReadonlyArray<Record<string, string[]>> } | undefined;
    const ipn = doc.paths?.['/api/v1/webhooks/momo']?.post as
      { security?: ReadonlyArray<Record<string, string[]>> } | undefined;
    expect(initiation?.security?.some((scheme) => 'cookieAuth' in scheme)).toBe(true);
    expect(ipn?.security).toBeUndefined();
  });
});
