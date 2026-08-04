/**
 * Contact normalization and equivalence checking
 *
 * Normalizes contact details for idempotency and digest computation
 */

import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { computeDigest } from './digest.js';

const VIETNAMESE_LOCAL_PHONE_PATTERN = /^0(?:3|5|7|8|9)\d{8}$/;

function normalizePhoneInput(value: string): string {
  return VIETNAMESE_LOCAL_PHONE_PATTERN.test(value) ? `+84${value.slice(1)}` : value;
}

export interface ContactInput {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

export interface NormalizedContact {
  readonly fullName: string;
  readonly email: string;
  readonly phoneE164: string;
  readonly emailDigest: Buffer;
}

export function normalizeContact(contact: ContactInput, digestSecret: Buffer): NormalizedContact {
  // Full name: trim, NFC-normalize, collapse internal whitespace
  const fullName = contact.fullName.trim().normalize('NFC').replace(/\s+/g, ' ');

  // Email: trim, lowercase, basic validation
  const email = contact.email.trim().toLowerCase();
  if (!email.includes('@') || email.length < 3) {
    throw new Error('Invalid email address');
  }

  // Phone: Vietnamese local mobile input is converted to E.164 first; other
  // numbers still require an explicit international country code.
  const trimmedPhone = normalizePhoneInput(contact.phone.trim());
  let parsedPhone;
  try {
    parsedPhone = parsePhoneNumberWithError(trimmedPhone);
  } catch {
    throw new Error('Invalid phone number');
  }
  if (!parsedPhone.isValid()) {
    throw new Error('Invalid phone number');
  }
  const phoneE164 = parsedPhone.number;

  // Compute email digest
  const emailDigest = computeDigest({
    secretKey: digestSecret,
    domainLabel: 'room-management/email-lookup/v1',
    parts: [Buffer.from(email, 'utf8')],
  });

  return {
    fullName,
    email,
    phoneE164,
    emailDigest,
  };
}

export function contactsAreEquivalent(a: NormalizedContact, b: NormalizedContact): boolean {
  return a.fullName === b.fullName && a.email === b.email && a.phoneE164 === b.phoneE164;
}

export function maskEmailForDisplay(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain || local.length < 2) {
    return email;
  }

  const first = local[0];
  const last = local[local.length - 1];
  const masked = first + '*'.repeat(local.length - 2) + last;

  return `${masked}@${domain}`;
}
