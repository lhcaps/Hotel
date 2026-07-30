import { describe, expect, it } from 'vitest';

import type { ActorContext } from '../../src/auth/actor-context.js';
import { CouponDeliveryError } from '../../src/booking/coupon-delivery.errors.js';
import { CouponDeliveryService } from '../../src/booking/services/coupon-delivery.service.js';

const actor: ActorContext = {
  userId: '660e8400-e29b-41d4-a716-446655440001',
  email: 'admin@example.test',
  displayName: 'Administrator',
  role: 'ADMIN',
  permissions: ['booking.lifecycle.manage', 'coupon.manage'],
  sessionId: '660e8400-e29b-41d4-a716-446655440002',
  sessionExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
  requestId: 'coupon-delivery-test',
};

describe('CouponDeliveryService', () => {
  it('queues validated coupon codes against the booking contact and preserves the idempotency key', async () => {
    const queued: unknown[] = [];
    const service = new CouponDeliveryService({
      queue: async (command) => {
        queued.push(command);
        return { deliveryId: '760e8400-e29b-41d4-a716-446655440001', status: 'PENDING' as const };
      },
    });

    await expect(
      service.request(actor, 'BOOKING-2026', { couponCodes: ['welcome-10'] }, 'delivery-2026-0001'),
    ).resolves.toEqual({ deliveryId: '760e8400-e29b-41d4-a716-446655440001', status: 'PENDING' });
    expect(queued).toEqual([
      {
        actorId: actor.userId,
        bookingCode: 'BOOKING-2026',
        couponCodes: ['WELCOME-10'],
        idempotencyKey: 'delivery-2026-0001',
      },
    ]);
  });

  it('rejects a missing or oversized idempotency key before querying the repository', async () => {
    const service = new CouponDeliveryService({
      queue: async () => ({ deliveryId: 'x', status: 'PENDING' }),
    });
    expect(() =>
      service.request(actor, 'BOOKING-2026', { couponCodes: ['WELCOME-10'] }, ''),
    ).toThrow(CouponDeliveryError);
    expect(() =>
      service.request(actor, 'BOOKING-2026', { couponCodes: ['WELCOME-10'] }, 'x'.repeat(129)),
    ).toThrow(CouponDeliveryError);
  });
});
