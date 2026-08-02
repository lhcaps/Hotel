import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  BookingAccessPassError,
  BookingAccessPassService,
} from '../../src/booking/services/booking-access-pass.service.js';

const secret = Buffer.from(
  'booking-access-pass-test-secret-that-is-at-least-thirty-two-bytes',
  'utf8',
);

describe('BookingAccessPassService', () => {
  it('issues a compact signed pass with no PII and verifies its binding', () => {
    const bookingId = randomUUID();
    const service = new BookingAccessPassService(secret);
    const pass = service.issue({
      bookingId,
      version: 1,
      expiresAt: new Date('2027-02-11T07:00:00.000Z'),
    });

    expect(pass).not.toMatch(/@|\+84|Tester|359000/i);
    expect(service.verify(pass, new Date('2027-02-10T07:00:00.000Z'))).toMatchObject({
      bookingId,
      version: 1,
    });
  });

  it('rejects tampering and expired passes', () => {
    const service = new BookingAccessPassService(secret);
    const pass = service.issue({
      bookingId: randomUUID(),
      version: 2,
      expiresAt: new Date('2027-02-10T07:00:00.000Z'),
    });
    const [payload, signature] = pass.split('.');
    expect(() =>
      service.verify(`${payload}x.${signature}`, new Date('2027-02-10T06:00:00.000Z')),
    ).toThrow(BookingAccessPassError);
    expect(() => service.verify(pass, new Date('2027-02-10T07:00:00.000Z'))).toThrow(
      BookingAccessPassError,
    );
  });

  it('renders a non-script SVG without persisting the pass', async () => {
    const service = new BookingAccessPassService(secret);
    const svg = await service.toSvg(
      service.issue({
        bookingId: randomUUID(),
        version: 1,
        expiresAt: new Date('2027-02-11T07:00:00.000Z'),
      }),
    );
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/<script\b/i);
  });
});
