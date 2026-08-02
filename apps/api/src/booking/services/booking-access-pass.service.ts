import { createHmac, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';

interface AccessPassPayload {
  readonly bookingId: string;
  readonly version: number;
  readonly expiresAt: number;
}

export class BookingAccessPassError extends Error {
  public readonly code = 'BOOKING_ACCESS_PASS_INVALID';

  public constructor() {
    super('Booking access pass is invalid, expired, or revoked.');
    this.name = 'BookingAccessPassError';
  }
}

export class BookingAccessPassService {
  public constructor(private readonly secret: Buffer) {
    if (secret.length < 32)
      throw new Error('BOOKING_ACCESS_QR_SECRET must contain at least 32 bytes');
  }

  public issue(input: {
    readonly bookingId: string;
    readonly version: number;
    readonly expiresAt: Date;
  }): string {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new Error('Booking access pass version must be a positive integer');
    }
    const expiresAt = Math.floor(input.expiresAt.getTime() / 1000);
    if (!Number.isSafeInteger(expiresAt)) throw new Error('Booking access pass expiry is invalid');
    const payload = Buffer.from(
      JSON.stringify({ bookingId: input.bookingId, version: input.version, expiresAt }),
      'utf8',
    ).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  public verify(value: string, now: Date): AccessPassPayload {
    const parts = value.split('.');
    if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) {
      throw new BookingAccessPassError();
    }
    const [payload, signature] = parts;
    const expected = this.sign(payload);
    const actualBytes = Buffer.from(signature, 'base64url');
    const expectedBytes = Buffer.from(expected, 'base64url');
    if (
      actualBytes.length !== expectedBytes.length ||
      !timingSafeEqual(actualBytes, expectedBytes)
    ) {
      throw new BookingAccessPassError();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new BookingAccessPassError();
    }
    if (!isPayload(parsed) || parsed.expiresAt <= Math.floor(now.getTime() / 1000)) {
      throw new BookingAccessPassError();
    }
    return parsed;
  }

  public toSvg(pass: string): Promise<string> {
    return QRCode.toString(pass, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    }).then((svg) => {
      if (/<script\b/i.test(svg)) throw new Error('QR SVG must not contain script');
      return svg;
    });
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload, 'utf8').digest('base64url');
  }
}

function isPayload(value: unknown): value is AccessPassPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.bookingId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      record.bookingId,
    ) &&
    typeof record.version === 'number' &&
    Number.isInteger(record.version) &&
    record.version > 0 &&
    typeof record.expiresAt === 'number' &&
    Number.isSafeInteger(record.expiresAt)
  );
}
