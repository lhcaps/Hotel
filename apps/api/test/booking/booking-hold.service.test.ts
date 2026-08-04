import { Buffer } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@room/booking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@room/booking')>();
  return {
    ...actual,
    createBookingHoldWithRetry: vi.fn(),
    normalizeContact: actual.normalizeContact,
  };
});

import {
  createBookingHoldWithRetry,
  normalizeContact,
  type BookingHoldResult,
  type CreateBookingHoldInput,
} from '@room/booking';
import {
  BookingHoldError,
  BookingHoldService,
} from '../../src/booking/services/booking-hold.service.js';

beforeEach(() => {
  (createBookingHoldWithRetry as unknown as ReturnType<typeof vi.fn>).mockReset();
});

const IP_SECRET = Buffer.from('a'.repeat(48), 'utf8');

const baseRequest = {
  contact: {
    fullName: 'Nguyen Van A',
    email: 'nguyen@example.com',
    phone: '+84909000000',
  },
};

const pool = {} as Parameters<typeof createBookingHoldWithRetry>[0];

async function setup(result: BookingHoldResult | Error) {
  if (result instanceof Error) {
    (createBookingHoldWithRetry as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      result,
    );
  } else {
    (createBookingHoldWithRetry as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      result,
    );
  }
  const service = new BookingHoldService({
    pool,
    holdDurationMs: 30 * 60 * 1000,
    ipDigestSecret: IP_SECRET,
  });
  return service;
}

const SUCCESS_RESULT = {
  bookingId: '11111111-1111-4111-8111-111111111111',
  bookingCode: 'RM-AB12-CD34-EF56',
  status: 'HOLD' as const,
  holdExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  checkIn: new Date('2026-07-23T04:00:00.000Z'),
  checkOut: new Date('2026-07-23T07:00:00.000Z'),
  amountVnd: 309000,
  currency: 'VND' as const,
  idempotent: false,
} as unknown as BookingHoldResult;

const SUCCESS_RESULT_WITH_COUPON = {
  ...SUCCESS_RESULT,
  coupon: {
    code: 'SUMMER-50K',
    discountType: 'FIXED' as const,
    grossAmountVnd: 359000,
    discountAmountVnd: 50000,
    finalAmountVnd: 309000,
  },
} as unknown as BookingHoldResult;

describe('BookingHoldService', () => {
  it('forwards the normalized contact and parameters to createBookingHoldWithRetry', async () => {
    const service = await setup(SUCCESS_RESULT);
    const result = await service.issue(
      '00000000-0000-0000-0000-000000000010',
      baseRequest,
      'correlation-1',
    );
    expect(result.bookingCode).toBe('RM-AB12-CD34-EF56');
    const expectedContact = normalizeContact(baseRequest.contact, IP_SECRET);
    expect(createBookingHoldWithRetry).toHaveBeenCalledWith(
      pool,
      expect.objectContaining<Partial<CreateBookingHoldInput>>({
        quoteId: '00000000-0000-0000-0000-000000000010',
        contact: expectedContact,
        holdDurationMs: 30 * 60 * 1000,
        correlationId: 'correlation-1',
      }),
    );
  });

  it('accepts a Vietnamese local phone and forwards its canonical E.164 value', async () => {
    const service = await setup(SUCCESS_RESULT);
    const expectedContact = normalizeContact(
      { ...baseRequest.contact, phone: '0909000000' },
      IP_SECRET,
    );
    await service.issue(
      '00000000-0000-0000-0000-000000000010',
      { ...baseRequest, contact: { ...baseRequest.contact, phone: '0909000000' } },
      'correlation-1',
    );

    expect(createBookingHoldWithRetry).toHaveBeenCalledWith(
      pool,
      expect.objectContaining<Partial<CreateBookingHoldInput>>({
        contact: expectedContact,
      }),
    );
  });

  it('rejects invalid input via Zod', async () => {
    const service = await setup(SUCCESS_RESULT);
    await expect(
      service.issue(
        '00000000-0000-0000-0000-000000000010',
        { guest: { fullName: '', email: 'bad', phoneE164: 'x' } },
        'correlation-1',
      ),
    ).rejects.toBeTruthy();
  });

  it.each([
    ['QuoteNotFoundError', 'QUOTE_NOT_FOUND'],
    ['QuoteExpiredError', 'QUOTE_EXPIRED'],
    ['QuoteAlreadyUsedError', 'QUOTE_ALREADY_USED'],
    ['RoomTypeUnavailableError', 'ROOM_TYPE_UNAVAILABLE'],
    ['AllocationBusyError', 'ALLOCATION_BUSY'],
    ['StaleHoldCleanupRetryError', 'STALE_HOLD_CLEANUP_RETRY'],
    ['CouponRequoteRequiredError', 'COUPON_REQUOTE_REQUIRED'],
    ['CouponHoldWindowIncompatibleError', 'COUPON_HOLD_WINDOW_INCOMPATIBLE'],
    ['CouponMinimumNotMetError', 'COUPON_MINIMUM_NOT_MET'],
    ['CouponLimitReachedError', 'COUPON_LIMIT_REACHED'],
    ['CouponCustomerLimitReachedError', 'COUPON_CUSTOMER_LIMIT_REACHED'],
    ['CouponExpiredError', 'COUPON_EXPIRED'],
  ] as const)('maps %s to %s', async (name, code) => {
    const error = new Error('boom');
    error.name = name;
    const service = await setup(error);
    await expect(
      service.issue('00000000-0000-0000-0000-000000000010', baseRequest, 'correlation-1'),
    ).rejects.toMatchObject({ code });
  });

  it('maps unknown errors to INTERNAL_ERROR', async () => {
    const service = await setup(new Error('something broke'));
    await expect(
      service.issue('00000000-0000-0000-0000-000000000010', baseRequest, 'correlation-1'),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('exposes the expected error code on BookingHoldError', async () => {
    const err = new BookingHoldError('QUOTE_NOT_FOUND', 'not found');
    expect(err.code).toBe('QUOTE_NOT_FOUND');
    expect(err.name).toBe('BookingHoldError');
  });

  it('surfaces a safe coupon summary when the booking HOLD includes one', async () => {
    const service = await setup(SUCCESS_RESULT_WITH_COUPON);
    const result = await service.issue(
      '00000000-0000-0000-0000-000000000010',
      baseRequest,
      'correlation-1',
    );
    expect(result.coupon).toEqual({
      code: 'SUMMER-50K',
      discountType: 'FIXED',
      grossAmountVnd: 359000,
      discountAmountVnd: 50000,
      finalAmountVnd: 309000,
    });
  });

  it('omits the coupon summary when no coupon was applied', async () => {
    const service = await setup(SUCCESS_RESULT);
    const result = await service.issue(
      '00000000-0000-0000-0000-000000000010',
      baseRequest,
      'correlation-1',
    );
    expect(result.coupon).toBeUndefined();
  });
});
