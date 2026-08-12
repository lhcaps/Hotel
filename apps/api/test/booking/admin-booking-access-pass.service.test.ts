import { describe, expect, it, vi } from 'vitest';

import { BookingAccessPassError } from '../../src/booking/services/booking-access-pass.service.js';
import { AdminBookingAccessPassService } from '../../src/booking/services/admin-booking-access-pass.service.js';
import type { BookingAccessPassRecord } from '../../src/booking/repositories/booking-detail.repository.js';

const booking: BookingAccessPassRecord = {
  bookingId: '00000000-0000-4000-8000-000000000001',
  bookingCode: 'RM-ACCESS-PASS-1',
  status: 'CONFIRMED' as const,
  accessPassVersion: 2,
  accessPassRevokedAt: null,
};
const propertyId = '00000000-0000-4000-8000-000000000101';

describe('AdminBookingAccessPassService', () => {
  function subject(
    overrides: {
      readonly payload?: {
        readonly bookingId: string;
        readonly version: number;
        readonly expiresAt: number;
      };
      readonly record?: BookingAccessPassRecord | null;
    } = {},
  ) {
    const passes = {
      verify: vi.fn().mockReturnValue(
        overrides.payload ?? {
          bookingId: booking.bookingId,
          version: booking.accessPassVersion,
          expiresAt: 1_800_000_000,
        },
      ),
    };
    const details = {
      findAccessPassRecord: vi.fn().mockResolvedValue(overrides.record ?? booking),
    };
    return {
      passes,
      details,
      service: new AdminBookingAccessPassService(passes as never, details as never),
    };
  }

  it('verifies a signed current pass and returns an ADMIN-only booking preview without the token', async () => {
    const { service, passes } = subject();
    const result = await service.scan(
      'signed-pass',
      new Date('2027-01-01T00:00:00.000Z'),
      propertyId,
    );

    expect(result).toEqual({
      bookingCode: booking.bookingCode,
      status: 'CONFIRMED',
      action: 'check-in',
    });
    expect(result).not.toHaveProperty('pass');
    expect(result).not.toHaveProperty('token');
    expect(passes.verify).toHaveBeenCalledWith('signed-pass', new Date('2027-01-01T00:00:00.000Z'));
  });

  it('rejects a pass whose version no longer matches the persisted booking', async () => {
    const { service } = subject({
      payload: { bookingId: booking.bookingId, version: 1, expiresAt: 1_800_000_000 },
    });
    await expect(service.scan('old-pass', new Date(), propertyId)).rejects.toBeInstanceOf(
      BookingAccessPassError,
    );
  });

  it('rejects a revoked or non-arrival booking before returning a preview', async () => {
    const { service: revoked } = subject({
      record: { ...booking, accessPassRevokedAt: new Date('2027-01-01T00:00:00.000Z') },
    });
    await expect(revoked.scan('revoked-pass', new Date(), propertyId)).rejects.toBeInstanceOf(
      BookingAccessPassError,
    );

    const { service: cancelled } = subject({ record: { ...booking, status: 'CANCELLED' } });
    await expect(cancelled.scan('cancelled-pass', new Date(), propertyId)).rejects.toBeInstanceOf(
      BookingAccessPassError,
    );
  });
});
