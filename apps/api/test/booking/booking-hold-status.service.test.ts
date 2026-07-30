import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import { BookingHoldStatusService } from '../../src/booking/services/booking-hold-status.service.js';
import type {
  GuestAccessSecrets,
} from '../../src/booking/repositories/guest-access.repository.js';
import type { DatabaseClient } from '@room/database';

const SECRETS: GuestAccessSecrets = {
  otpSecret: Buffer.from('a'.repeat(48), 'utf8'),
  challengeRefSecret: Buffer.from('b'.repeat(48), 'utf8'),
  sessionSecret: Buffer.from('c'.repeat(48), 'utf8'),
  ipDigestSecret: Buffer.from('d'.repeat(48), 'utf8'),
};

function serviceWith(rows: Array<Record<string, unknown>>) {
  const execute = vi.fn(async () => ({ rows }));
  const service = new BookingHoldStatusService(
    { execute } as unknown as DatabaseClient,
    SECRETS,
  );
  return { service, execute };
}

const NOW = new Date('2026-07-23T00:00:00.000Z');

describe('BookingHoldStatusService', () => {
  it('returns UNKNOWN when no row matches the bookingCode + email digest pair', async () => {
    const { service } = serviceWith([]);
    const result = await service.status(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'guest@example.com' },
      NOW,
    );
    expect(result.status).toBe('UNKNOWN');
    expect(result.holdExpiresAt).toBeNull();
    expect(result.serverTime).toBe(NOW.toISOString());
  });

  it('returns EXPIRED when hold_expires_at is in the past', async () => {
    const { service } = serviceWith([
      {
        booking_id: '11111111-1111-4111-8111-111111111111',
        status: 'HOLD',
        hold_expires_at: new Date('2026-07-22T00:00:00.000Z'),
      },
    ]);
    const result = await service.status(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'guest@example.com' },
      NOW,
    );
    expect(result.status).toBe('EXPIRED');
    expect(result.holdExpiresAt).toBe('2026-07-22T00:00:00.000Z');
  });

  it('returns HOLD with the future expiry when the hold is still active', async () => {
    const { service } = serviceWith([
      {
        booking_id: '11111111-1111-4111-8111-111111111111',
        status: 'HOLD',
        hold_expires_at: new Date('2027-01-01T00:00:00.000Z'),
      },
    ]);
    const result = await service.status(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'guest@example.com' },
      NOW,
    );
    expect(result.status).toBe('HOLD');
    expect(result.holdExpiresAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('returns UNKNOWN for non-HOLD bookings (the hold phase is over)', async () => {
    const { service } = serviceWith([
      {
        booking_id: '11111111-1111-4111-8111-111111111111',
        status: 'CONFIRMED',
        hold_expires_at: null,
      },
    ]);
    const result = await service.status(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'guest@example.com' },
      NOW,
    );
    expect(result.status).toBe('UNKNOWN');
    expect(result.holdExpiresAt).toBeNull();
  });

  it('parses string timestamps returned by the driver', async () => {
    const { service } = serviceWith([
      {
        booking_id: '11111111-1111-4111-8111-111111111111',
        status: 'HOLD',
        hold_expires_at: '2027-01-01T00:00:00.000Z',
      },
    ]);
    const result = await service.status(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'guest@example.com' },
      NOW,
    );
    expect(result.status).toBe('HOLD');
    expect(result.holdExpiresAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('rejects invalid input via Zod', async () => {
    const { service } = serviceWith([]);
    await expect(service.status({ bookingCode: 'rm', email: 'bad' }, NOW)).rejects.toBeTruthy();
  });

  it('executes the status query exactly once per call', async () => {
    const { service, execute } = serviceWith([]);
    await service.status(
      { bookingCode: 'RM-AB12-CD34-EF56', email: 'Guest@Example.COM' },
      NOW,
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
