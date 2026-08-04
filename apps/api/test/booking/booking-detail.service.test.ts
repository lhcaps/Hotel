import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import {
  BookingDetailService,
  BookingNotFoundError,
} from '../../src/booking/services/booking-detail.service.js';
import {
  GuestSessionRequiredError,
  GuestSessionService,
} from '../../src/booking/services/guest-session.service.js';
import { BookingAccessPassService } from '../../src/booking/services/booking-access-pass.service.js';
import type { BookingDetailRecord } from '../../src/booking/repositories/booking-detail.repository.js';

function record(overrides: Partial<BookingDetailRecord> = {}): BookingDetailRecord {
  return {
    bookingId: '00000000-0000-0000-0000-000000000001',
    customerUserId: null,
    propertyId: '00000000-0000-0000-0000-000000000010',
    roomTypeId: '00000000-0000-0000-0000-000000000020',
    bookingCode: 'RM-AB12-CD34-EF56',
    status: 'HOLD',
    propertyCode: 'PROP-1',
    propertyName: 'Aurora Hotel',
    propertyTimezone: 'Asia/Ho_Chi_Minh',
    roomTypeCode: 'RT-STD',
    roomTypeName: 'Standard',
    maxOccupancy: 2,
    checkIn: new Date('2026-07-23T04:00:00.000Z'),
    checkOut: new Date('2026-07-23T07:00:00.000Z'),
    adults: 2,
    children: 0,
    finalAmountVnd: 359000,
    currency: 'VND',
    holdExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
    accessPassVersion: 1,
    accessPassRevokedAt: null,
    fullName: 'Nguyen Van A',
    normalizedEmail: 'anna@example.com',
    normalizedPhoneE164: '+84909000000',
    cancellationPolicySnapshot: null,
    coupon: null,
    ...overrides,
  };
}

function services(overrides: {
  find?: (code: string) => Promise<BookingDetailRecord | null>;
  requireForBooking?: (token: Buffer | null, bookingId: string, now: Date) => Promise<unknown>;
}) {
  const repository = {
    findByBookingCodeForSession: vi.fn().mockImplementation(overrides.find ?? (async () => null)),
  };
  const session = {
    requireForBooking: vi
      .fn()
      .mockImplementation(overrides.requireForBooking ?? (async () => undefined)),
  } as unknown as GuestSessionService;
  return {
    service: new BookingDetailService(repository as never, session),
    repository,
    session,
  };
}

describe('BookingDetailService', () => {
  it('issues a guest-authorized SVG access pass for a confirmed booking', async () => {
    const confirmed = Object.assign(record({ status: 'CONFIRMED', holdExpiresAt: null }), {
      accessPassVersion: 1,
      accessPassRevokedAt: null,
    });
    const { service, session } = services({
      find: async () => confirmed,
      requireForBooking: async () => ({ bookingId: confirmed.bookingId }),
    });
    const subject = service as unknown as {
      getAccessPass(
        bookingCode: string,
        token: Buffer | null,
        now: Date,
        passes: BookingAccessPassService,
      ): Promise<{ bookingCode: string; expiresAt: string; svg: string }>;
    };

    const result = await subject.getAccessPass(
      confirmed.bookingCode,
      Buffer.alloc(32),
      new Date('2027-01-01T00:00:00.000Z'),
      new BookingAccessPassService(
        Buffer.from('booking-detail-access-pass-test-secret-at-least-32-bytes', 'utf8'),
      ),
    );

    expect(result).toMatchObject({
      bookingCode: confirmed.bookingCode,
      expiresAt: '2026-07-23T08:00:00.000Z',
    });
    expect(result.svg).toContain('<svg');
    expect(session.requireForBooking).toHaveBeenCalledWith(
      expect.any(Buffer),
      confirmed.bookingId,
      new Date('2027-01-01T00:00:00.000Z'),
    );
  });

  it('throws when the booking code is unknown', async () => {
    const { service } = services({});
    await expect(
      service.getByBookingCode('RM-AB12-CD34-EF56', Buffer.alloc(8), new Date()),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it('rejects when no session token is provided', async () => {
    const { service, repository } = services({
      find: async () => record(),
      requireForBooking: async () => {
        throw new GuestSessionRequiredError();
      },
    });
    await expect(
      service.getByBookingCode('RM-AB12-CD34-EF56', null, new Date()),
    ).rejects.toBeInstanceOf(GuestSessionRequiredError);
    expect(repository.findByBookingCodeForSession).toHaveBeenCalled();
  });

  it('returns masked contact fields and serialised timestamps for the happy path', async () => {
    const { service, session } = services({
      find: async () => record({ normalizedPhoneE164: '+84909000000' }),
      requireForBooking: async () => ({ bookingId: '00000000-0000-0000-0000-000000000001' }),
    });
    const result = await service.getByBookingCode(
      'RM-AB12-CD34-EF56',
      Buffer.alloc(8),
      new Date('2026-07-23T00:00:00.000Z'),
    );
    expect(result.bookingCode).toBe('RM-AB12-CD34-EF56');
    expect(result.contact.emailMasked).not.toBe('a@example.com');
    expect(result.contact.emailMasked).toContain('*');
    expect(result.contact.phoneMasked).toContain('•');
    expect(session.requireForBooking).toHaveBeenCalled();
  });

  it('emits a null holdExpiresAt when the booking is not in HOLD state', async () => {
    const { service } = services({
      find: async () => record({ status: 'CONFIRMED', holdExpiresAt: null }),
      requireForBooking: async () => ({}),
    });
    const result = await service.getByBookingCode(
      'RM-AB12-CD34-EF56',
      Buffer.alloc(8),
      new Date('2026-07-23T00:00:00.000Z'),
    );
    expect(result.status).toBe('CONFIRMED');
    expect(result.holdExpiresAt).toBeNull();
  });

  it('keeps a guest detail readable after check-in', async () => {
    const { service } = services({
      find: async () => record({ status: 'CHECKED_IN', holdExpiresAt: null }),
      requireForBooking: async () => ({}),
    });

    const result = await service.getByBookingCode(
      'RM-AB12-CD34-EF56',
      Buffer.alloc(8),
      new Date('2026-07-23T00:00:00.000Z'),
    );

    expect(result.status).toBe('CHECKED_IN');
  });

  it('masks very short phone numbers as-is', async () => {
    const { service } = services({
      find: async () => record({ normalizedPhoneE164: '+84' }),
      requireForBooking: async () => ({}),
    });
    const result = await service.getByBookingCode(
      'RM-AB12-CD34-EF56',
      Buffer.alloc(8),
      new Date('2026-07-23T00:00:00.000Z'),
    );
    expect(result.contact.phoneMasked).toBe('+84');
  });

  it('omits the coupon summary when no application row is attached', async () => {
    const { service } = services({
      find: async () => record(),
      requireForBooking: async () => ({}),
    });
    const result = await service.getByBookingCode(
      'RM-AB12-CD34-EF56',
      Buffer.alloc(8),
      new Date('2026-07-23T00:00:00.000Z'),
    );
    expect(result.coupon).toBeUndefined();
  });

  it('exposes a safe coupon summary when an active application is attached', async () => {
    const { service } = services({
      find: async () =>
        record({
          finalAmountVnd: 309000,
          coupon: {
            code: 'SUMMER-50K',
            discountType: 'FIXED',
            grossAmountVnd: 359000,
            discountAmountVnd: 50000,
            finalAmountVnd: 309000,
          },
        }),
      requireForBooking: async () => ({}),
    });
    const result = await service.getByBookingCode(
      'RM-AB12-CD34-EF56',
      Buffer.alloc(8),
      new Date('2026-07-23T00:00:00.000Z'),
    );
    expect(result.coupon).toEqual({
      code: 'SUMMER-50K',
      discountType: 'FIXED',
      grossAmountVnd: 359000,
      discountAmountVnd: 50000,
      finalAmountVnd: 309000,
    });
    expect(result.amountVnd).toBe(309000);
  });
});
