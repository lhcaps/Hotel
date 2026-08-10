import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/iu;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function hashFile(path) {
  return sha256(readFileSync(path));
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('Canonical JSON cannot contain a non-finite number.');
    }
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
      throw new Error('Canonical JSON cannot contain an unsupported value.');
    }
    return value;
  }

  const result = {};
  for (const key of Object.keys(value).sort()) {
    const entry = value[key];
    if (typeof entry === 'undefined') {
      throw new Error(`Canonical JSON cannot contain undefined at ${key}.`);
    }
    result[key] = canonicalize(entry);
  }
  return result;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function readJsonFile(path, description) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to read ${description}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function assertPlainObject(value, description) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${description} must be an object.`);
  }
}

export function assertSha256(value, description) {
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    throw new Error(`${description} must be a lowercase SHA-256 digest.`);
  }
}
