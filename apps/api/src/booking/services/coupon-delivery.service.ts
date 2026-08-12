import {
  adminBookingCouponDeliverySchema,
  type AdminBookingCouponDelivery,
  type CouponDeliveryQueueResult as CouponDeliveryQueueResultContract,
} from '@room/contracts';

import type { ActorContext } from '../../auth/actor-context.js';
import { CouponDeliveryError } from '../coupon-delivery.errors.js';

export interface CouponDeliveryQueueCommand {
  readonly actorId: string;
  readonly propertyId: string;
  readonly bookingCode: string;
  readonly couponCodes: readonly string[];
  readonly idempotencyKey: string;
}

export type CouponDeliveryQueueResult = CouponDeliveryQueueResultContract;

export interface CouponDeliveryRepositoryPort {
  queue(command: CouponDeliveryQueueCommand): Promise<CouponDeliveryQueueResult>;
}

const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

function parseIdempotencyKey(value: string): string {
  const key = value.trim();
  if (key.length < IDEMPOTENCY_KEY_MIN_LENGTH || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new CouponDeliveryError('COUPON_DELIVERY_IDEMPOTENCY_REQUIRED');
  }
  return key;
}

export class CouponDeliveryService {
  public constructor(private readonly repository: CouponDeliveryRepositoryPort) {}

  public request(
    actor: ActorContext,
    bookingCode: string,
    input: unknown,
    idempotencyKey: string,
    propertyId?: string,
  ): Promise<CouponDeliveryQueueResult> {
    if (propertyId === undefined) {
      throw new CouponDeliveryError('COUPON_DELIVERY_BOOKING_NOT_FOUND');
    }
    const command: AdminBookingCouponDelivery = adminBookingCouponDeliverySchema.parse(input);
    return this.repository.queue({
      actorId: actor.userId,
      propertyId,
      bookingCode,
      couponCodes: command.couponCodes,
      idempotencyKey: parseIdempotencyKey(idempotencyKey),
    });
  }
}
