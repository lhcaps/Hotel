import type { DatabasePool } from '@room/database';

import type {
  CouponDeliveryQueueCommand,
  CouponDeliveryQueueResult,
  CouponDeliveryRepositoryPort,
} from '../services/coupon-delivery.service.js';
import { CouponDeliveryError } from '../coupon-delivery.errors.js';

export class CouponDeliveryRepository implements CouponDeliveryRepositoryPort {
  public constructor(private readonly pool: DatabasePool) {}

  public async queue(command: CouponDeliveryQueueCommand): Promise<CouponDeliveryQueueResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const booking = await client.query<{ id: string; property_id: string }>(
        `SELECT b.id, b.property_id FROM bookings b JOIN booking_contacts bc ON bc.booking_id = b.id
          WHERE b.property_id = $1
            AND b.booking_code = $2`,
        [command.propertyId, command.bookingCode],
      );
      const row = booking.rows[0];
      if (row === undefined) throw new CouponDeliveryError('COUPON_DELIVERY_BOOKING_NOT_FOUND');
      const allowed = await client.query<{ normalized_code: string }>(
        `SELECT normalized_code FROM coupons WHERE property_id = $1 AND normalized_code = ANY($2::text[])
          AND status = 'ACTIVE' AND valid_from <= CURRENT_TIMESTAMP AND valid_until > CURRENT_TIMESTAMP`,
        [row.property_id, [...command.couponCodes]],
      );
      if (allowed.rows.length !== command.couponCodes.length) {
        throw new CouponDeliveryError('COUPON_DELIVERY_COUPON_UNAVAILABLE');
      }
      const inserted = await client.query<{
        id: string;
        status: 'PENDING' | 'SENT';
        coupon_codes: string[];
      }>(
        `INSERT INTO coupon_delivery_requests (property_id, booking_id, idempotency_key, coupon_codes)
         VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (property_id, idempotency_key) DO NOTHING
         RETURNING id, status, coupon_codes`,
        [row.property_id, row.id, command.idempotencyKey, JSON.stringify(command.couponCodes)],
      );
      const delivery =
        inserted.rows[0] ??
        (
          await client.query<{ id: string; status: 'PENDING' | 'SENT'; coupon_codes: string[] }>(
            `SELECT id, status, coupon_codes FROM coupon_delivery_requests WHERE property_id = $1 AND idempotency_key = $2`,
            [row.property_id, command.idempotencyKey],
          )
        ).rows[0];
      if (
        delivery === undefined ||
        JSON.stringify(delivery.coupon_codes) !== JSON.stringify(command.couponCodes)
      ) {
        throw new CouponDeliveryError('COUPON_DELIVERY_IDEMPOTENCY_CONFLICT');
      }
      if (inserted.rows[0] !== undefined) {
        await client.query(
          `INSERT INTO outbox_events (property_id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1, 'COUPON_DELIVERY', $2, 'coupon.delivery.requested', $3::jsonb)`,
          [row.property_id, delivery.id, JSON.stringify({ deliveryId: delivery.id })],
        );
        await client.query(
          `INSERT INTO audit_events (property_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, payload)
           VALUES ($1, 'COUPON_DELIVERY', $2, 'COUPON_DELIVERY_QUEUED', 'ADMIN', $3, $4::jsonb)`,
          [
            row.property_id,
            delivery.id,
            command.actorId,
            JSON.stringify({ couponCount: command.couponCodes.length }),
          ],
        );
      }
      await client.query('COMMIT');
      return { deliveryId: delivery.id, status: delivery.status };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
