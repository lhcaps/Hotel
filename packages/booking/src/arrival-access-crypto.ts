import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

export type ArrivalAccessScope = 'property' | 'room';

export interface ArrivalAccessCryptoContext {
  readonly scope: ArrivalAccessScope;
  readonly id: string;
  readonly field: 'gatePass' | 'wifiPassword' | 'roomPass';
}

export class ArrivalAccessCryptoError extends Error {
  public constructor() {
    super('Arrival access configuration cannot be decrypted.');
    this.name = 'ArrivalAccessCryptoError';
  }
}

/**
 * Domain-separates arrival-data encryption from the booking QR HMAC root.
 * The root itself remains governed by the existing runtime environment.
 */
export function deriveArrivalAccessEncryptionKey(root: Buffer): Buffer {
  if (root.length < 32)
    throw new Error('Booking access root secret must contain at least 32 bytes.');
  return Buffer.from(
    hkdfSync(
      'sha256',
      root,
      Buffer.alloc(0),
      Buffer.from('peacenest-arrival-access-encryption:v1', 'utf8'),
      32,
    ),
  );
}

/**
 * Small authenticated-encryption boundary for guest-visible arrival secrets.
 * A caller must derive a dedicated 32-byte key outside this class. Ciphertext
 * is bound to its owner and field so it cannot be copied between records.
 */
export class ArrivalAccessCrypto {
  public constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error('Arrival access encryption key must be 32 bytes.');
  }

  public encrypt(value: string, context: ArrivalAccessCryptoContext): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(this.associatedData(context));
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  public decrypt(value: string, context: ArrivalAccessCryptoContext): string {
    const parts = value.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new ArrivalAccessCryptoError();
    const [, encodedIv, encodedTag, encodedCiphertext] = parts;
    if (encodedIv === undefined || encodedTag === undefined || encodedCiphertext === undefined) {
      throw new ArrivalAccessCryptoError();
    }
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(encodedIv, 'base64url'),
      );
      decipher.setAAD(this.associatedData(context));
      decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ArrivalAccessCryptoError();
    }
  }

  private associatedData(context: ArrivalAccessCryptoContext): Buffer {
    return Buffer.from(
      `peacenest-arrival-access:v1:${context.scope}:${context.id}:${context.field}`,
      'utf8',
    );
  }
}
