import { sql, type DatabaseClient } from '@room/database';

export interface PaymentStatusRecord {
  readonly provider: 'MOMO' | 'VNPAY' | null;
  readonly paymentStatus:
    'PENDING' | 'SUCCEEDED' | 'REVIEW_REQUIRED' | 'CANCELLED' | 'EXPIRED' | null;
  readonly attemptStatus:
    'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REVIEW_REQUIRED' | 'EXPIRED' | 'CANCELLED' | null;
  readonly bookingStatus: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  readonly amountVnd: string | number | bigint;
  readonly currency: 'VND';
  readonly createdAt: Date | string | null;
  readonly updatedAt: Date | string | null;
  readonly completedAt: Date | string | null;
}

interface PaymentStatusRow {
  provider: PaymentStatusRecord['provider'];
  payment_status: PaymentStatusRecord['paymentStatus'];
  attempt_status: PaymentStatusRecord['attemptStatus'];
  booking_status: PaymentStatusRecord['bookingStatus'];
  amount_vnd: PaymentStatusRecord['amountVnd'];
  currency: PaymentStatusRecord['currency'];
  created_at: PaymentStatusRecord['createdAt'];
  updated_at: PaymentStatusRecord['updatedAt'];
  completed_at: PaymentStatusRecord['completedAt'];
}

export class PaymentStatusRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByBookingId(bookingId: string): Promise<PaymentStatusRecord | null> {
    const result = await this.client.execute<PaymentStatusRow & Record<string, unknown>>(sql`
      SELECT latest_attempt.provider,
             payment.status AS payment_status,
             latest_attempt.status AS attempt_status,
             booking.status AS booking_status,
             booking.final_amount_vnd AS amount_vnd,
             booking.currency,
             payment.created_at,
             payment.updated_at,
             COALESCE(latest_attempt.completed_at, payment.succeeded_at, payment.review_required_at,
                      payment.cancelled_at, payment.expired_at) AS completed_at
        FROM bookings booking
        LEFT JOIN payments payment ON payment.booking_id = booking.id
        LEFT JOIN LATERAL (
          SELECT provider, status, completed_at, initiated_at, id
            FROM payment_attempts
           WHERE payment_id = payment.id
           ORDER BY initiated_at DESC, id DESC
           LIMIT 1
        ) latest_attempt ON TRUE
       WHERE booking.id = ${bookingId}
    `);
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      provider: row.provider,
      paymentStatus: row.payment_status,
      attemptStatus: row.attempt_status,
      bookingStatus: row.booking_status,
      amountVnd: row.amount_vnd,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }
}
