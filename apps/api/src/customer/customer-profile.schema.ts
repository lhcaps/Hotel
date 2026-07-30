export class CustomerProfileValidationError extends Error {
  public readonly issues: readonly string[] = [];
  public constructor(issues: readonly string[]) {
    super(`Invalid customer profile payload: ${issues.join(', ')}`);
    this.name = 'CustomerProfileValidationError';
    this.issues = issues;
  }
}

export interface CustomerProfilePatchInput {
  readonly name?: string;
  readonly phone?: string | null;
  readonly addressLine1?: string | null;
  readonly addressLine2?: string | null;
  readonly ward?: string | null;
  readonly district?: string | null;
  readonly province?: string | null;
  readonly postalCode?: string | null;
  readonly countryCode?: string;
}

const PHONE_PATTERN = /^\+[1-9][0-9]{6,14}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

function trimOrNull(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function validatePhone(value: unknown): { ok: true; value: string | null } | { ok: false; reason: string } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, reason: 'Phone must be a string' };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > 32) return { ok: false, reason: 'Phone must not exceed 32 characters' };
  if (!PHONE_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'Phone must be in E.164 format (e.g. +84901234567)' };
  }
  return { ok: true, value: trimmed };
}

export function parseCustomerProfilePatch(input: unknown): CustomerProfilePatchInput {
  if (typeof input !== 'object' || input === null) {
    throwIssues(['Patch payload must be an object']);
  }
  const body = input as Record<string, unknown>;
  const issues: string[] = [];
  const out: Record<string, unknown> = {};

  const nameRaw = body['name'];
  if (typeof nameRaw !== 'string') {
    issues.push('Name is required');
  } else {
    const trimmed = nameRaw.trim();
    if (trimmed.length === 0) issues.push('Name must not be empty');
    if (trimmed.length > 120) issues.push('Name must be 120 characters or fewer');
    out['name'] = trimmed;
  }

  const phone = validatePhone(body['phone']);
  if (!phone.ok) issues.push(phone.reason);
  else out['phone'] = phone.value;

  const phoneLengthCheck = out['phone'];
  if (typeof phoneLengthCheck === 'string' && (phoneLengthCheck as string).length > 32) {
    issues.push('Phone must not exceed 32 characters');
  }

  for (const [field, max] of [
    ['addressLine1', 200],
    ['addressLine2', 200],
    ['ward', 200],
    ['district', 200],
    ['province', 200],
    ['postalCode', 32],
  ] as const) {
    out[field] = trimOrNull(body[field], max);
  }

  const country = body['countryCode'];
  if (country === undefined) {
    out['countryCode'] = 'VN';
  } else if (typeof country !== 'string' || !COUNTRY_PATTERN.test(country)) {
    issues.push('Country code must be a 2-letter ISO code');
  } else {
    out['countryCode'] = country;
  }

  if (issues.length > 0) {
    throwIssues(issues);
  }
  return out as CustomerProfilePatchInput;
}

function throwIssues(issues: readonly string[]): never {
  throw new CustomerProfileValidationError(issues);
}
