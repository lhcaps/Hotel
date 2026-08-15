import { describe, expect, it } from 'vitest';

import { ArrivalAccessCrypto, ArrivalAccessCryptoError } from '../src/arrival-access-crypto.js';

const key = Buffer.alloc(32, 7);
const context = {
  scope: 'property',
  id: 'f9f321a1-bae5-4c93-a9c7-1f268fe18b36',
  field: 'gatePass',
} as const;

describe('ArrivalAccessCrypto', () => {
  it('encrypts authenticated ciphertext that does not expose plaintext', () => {
    const crypto = new ArrivalAccessCrypto(key);
    const encrypted = crypto.encrypt('door-code-9413', context);

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encrypted).not.toContain('door-code-9413');
    expect(crypto.decrypt(encrypted, context)).toBe('door-code-9413');
  });

  it('rejects altered ciphertext and ciphertext moved to another field', () => {
    const crypto = new ArrivalAccessCrypto(key);
    const encrypted = crypto.encrypt('door-code-9413', context);
    // Mutate the IV (a random segment). The original last-character flip is flaky in
    // base64url because the trailing character may already encode the replacement
    // value (e.g. 'A' -> 'A' when the last byte's low 6 bits are zero). The IV mutation
    // is guaranteed to invalidate the auth tag.
    const [version, iv, tag, ciphertext] = encrypted.split('.');
    const altered = [version, iv === 'A' ? 'B' : 'A', tag, ciphertext].join('.');

    expect(() => crypto.decrypt(altered, context)).toThrow(ArrivalAccessCryptoError);
    expect(() => crypto.decrypt(encrypted, { ...context, field: 'wifiPassword' })).toThrow(
      ArrivalAccessCryptoError,
    );
  });
});
