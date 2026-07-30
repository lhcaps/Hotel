import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const errorDocPath = resolve(import.meta.dirname, '../../../docs/contracts/errors.md');
const publicArtifactPath = resolve(import.meta.dirname, '../../../docs/openapi/public-v1.json');

type OpenApiDocument = {
  readonly components?: { readonly responses?: Record<string, Record<string, unknown>> };
};

async function loadArtifact(): Promise<OpenApiDocument> {
  return JSON.parse(await readFile(publicArtifactPath, 'utf8')) as OpenApiDocument;
}

const EXPECTED_CODES = [
  'QUOTE_NOT_FOUND',
  'QUOTE_EXPIRED',
  'QUOTE_ALREADY_USED',
  'ROOM_TYPE_UNAVAILABLE',
  'ALLOCATION_BUSY',
  'STALE_HOLD_CLEANUP_RETRY',
  'OTP_INVALID_OR_EXPIRED',
  'OTP_RATE_LIMITED',
  'GUEST_SESSION_REQUIRED',
  'GUEST_SESSION_INVALID',
] as const;

const CODE_TO_TYPE: Record<(typeof EXPECTED_CODES)[number], string> = {
  QUOTE_NOT_FOUND: 'quote-unavailable',
  QUOTE_EXPIRED: 'quote-expired',
  QUOTE_ALREADY_USED: 'booking-hold-quote-already-used',
  ROOM_TYPE_UNAVAILABLE: 'booking-hold-room-type-unavailable',
  ALLOCATION_BUSY: 'booking-hold-allocation-busy',
  STALE_HOLD_CLEANUP_RETRY: 'booking-hold-stale-hold-cleanup-retry',
  OTP_INVALID_OR_EXPIRED: 'otp-invalid-or-expired',
  OTP_RATE_LIMITED: 'otp-rate-limited',
  GUEST_SESSION_REQUIRED: 'guest-session-required',
  GUEST_SESSION_INVALID: 'guest-session-invalid',
};

describe('public error catalog ↔ OpenAPI artifact consistency', () => {
  it('errors.md documents every public code listed in the prompt', async () => {
    const text = await readFile(errorDocPath, 'utf8');
    for (const code of EXPECTED_CODES) {
      expect(text, `errors.md must mention ${code}`).toContain(`\`${code}\``);
    }
  });

  it('errors.md does not embed SQLSTATE codes or DB constraint identifiers in its catalog table', async () => {
    const text = await readFile(errorDocPath, 'utf8');
    const tableSection = text.split('## What is NOT in the catalog')[0] ?? text;
    expect(tableSection).not.toMatch(/SQLSTATE/);
    expect(tableSection).not.toMatch(/23P01|23505|42P01/);
    expect(tableSection).not.toMatch(/CONSTRAINT\s+\w+/);
  });

  it('every documented code maps to a public RFC 7807 type in errors.md', async () => {
    const text = await readFile(errorDocPath, 'utf8');
    for (const code of EXPECTED_CODES) {
      const type = CODE_TO_TYPE[code];
      expect(
        text.includes(type),
        `errors.md must reference the type ${type} for code ${code}`,
      ).toBe(true);
    }
  });

  it('every documented code maps to a public OpenAPI response component', async () => {
    const doc = await loadArtifact();
    const responses = doc.components?.responses ?? {};
    const codeToComponent: Record<string, string> = {
      QUOTE_NOT_FOUND: 'QuoteUnavailable',
      QUOTE_EXPIRED: 'QuoteExpired',
      QUOTE_ALREADY_USED: 'BookingHoldConflict',
      ROOM_TYPE_UNAVAILABLE: 'BookingHoldConflict',
      ALLOCATION_BUSY: 'BookingHoldConflict',
      STALE_HOLD_CLEANUP_RETRY: 'BookingHoldCleanupRetry',
      OTP_INVALID_OR_EXPIRED: 'OtpInvalidOrExpired',
      OTP_RATE_LIMITED: 'OtpRateLimited',
      GUEST_SESSION_REQUIRED: 'GuestSessionRequired',
      GUEST_SESSION_INVALID: 'GuestSessionRequired',
    };
    for (const code of EXPECTED_CODES) {
      const component = codeToComponent[code];
      expect(component, `code ${code} must map to a known component`).toBeDefined();
      expect(
        responses[component as string],
        `code ${code} should map to response component ${component}`,
      ).toBeDefined();
    }
  });
});
