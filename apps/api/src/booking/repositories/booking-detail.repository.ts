import { sql, type DatabaseClient } from '@room/database';

export interface BookingDetailRecord {
  readonly bookingId: string;
  readonly customerUserId: string | null;
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly bookingCode: string;
  readonly status:
    'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_IN' | 'CHECKED_OUT';
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly adults: number;
  readonly children: number;
  readonly currency: 'VND';
  readonly finalAmountVnd: number;
  readonly holdExpiresAt: Date | null;
  readonly accessPassVersion: number;
  readonly accessPassRevokedAt: Date | null;
  readonly propertyCode: string;
  readonly propertyName: string;
  readonly propertyTimezone: string;
  readonly roomTypeCode: string;
  readonly roomTypeName: string;
  readonly maxOccupancy: number;
  readonly fullName: string;
  readonly normalizedEmail: string;
  readonly normalizedPhoneE164: string;
  readonly cancellationPolicySnapshot: unknown;
  readonly coupon: BookingDetailCouponSnapshot | null;
}

export interface BookingDetailCouponSnapshot {
  readonly code: string;
  readonly discountType: 'FIXED' | 'PERCENTAGE';
  readonly grossAmountVnd: number;
  readonly discountAmountVnd: number;
  readonly finalAmountVnd: number;
}

export interface BookingAccessPassRecord {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: BookingDetailRecord['status'];
  readonly accessPassVersion: number;
  readonly accessPassRevokedAt: Date | null;
}

interface DetailRow {
  booking_id: string;
  customer_user_id: string | null;
  property_id: string;
  room_type_id: string;
  booking_code: string;
  status: BookingDetailRecord['status'];
  check_in: Date | string;
  check_out: Date | string;
  adults: number;
  children: number;
  currency: 'VND';
  final_amount_vnd: string | number | bigint;
  hold_expires_at: Date | string | null;
  access_pass_version: number;
  access_pass_revoked_at: Date | string | null;
  property_code: string;
  property_name: string;
  property_timezone: string;
  room_type_code: string;
  room_type_name: string;
  max_occupancy: number;
  full_name: string;
  normalized_email: string;
  normalized_phone_e164: string;
  cancellation_policy_snapshot: unknown;
  coupon_code: string | null;
  coupon_discount_type: 'FIXED' | 'PERCENTAGE' | null;
  coupon_gross_amount_vnd: string | number | bigint | null;
  coupon_discount_amount_vnd: string | number | bigint | null;
  coupon_final_amount_vnd: string | number | bigint | null;
}

function asDate(value: Date | string, field: string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}`);
  }
  return parsed;
}

function asBigIntAmount(value: string | number | bigint): number {
  if (typeof value === 'number') return value;
  const big = typeof value === 'string' ? BigInt(value) : value;
  if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(0)) {
    throw new Error('final_amount_vnd is out of safe range');
  }
  return Number(big);
}

function asOptionalBigIntAmount(value: string | number | bigint | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number') return value;
  const big = typeof value === 'string' ? BigInt(value) : value;
  if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(0)) {
    throw new Error('coupon amount is out of safe range');
  }
  return Number(big);
}

function readCoupon(row: DetailRow): BookingDetailCouponSnapshot | null {
  if (row.coupon_code === null || row.coupon_discount_type === null) return null;
  const gross = asOptionalBigIntAmount(row.coupon_gross_amount_vnd);
  const discount = asOptionalBigIntAmount(row.coupon_discount_amount_vnd);
  const final = asOptionalBigIntAmount(row.coupon_final_amount_vnd);
  if (gross === null || discount === null || final === null) return null;
  return {
    code: row.coupon_code,
    discountType: row.coupon_discount_type,
    grossAmountVnd: gross,
    discountAmountVnd: discount,
    finalAmountVnd: final,
  };
}

export function toBookingDetailRecord(row: DetailRow): BookingDetailRecord {
  return {
    bookingId: row.booking_id,
    customerUserId: row.customer_user_id,
    propertyId: row.property_id,
    roomTypeId: row.room_type_id,
    bookingCode: row.booking_code,
    status: row.status,
    checkIn: asDate(row.check_in, 'check_in'),
    checkOut: asDate(row.check_out, 'check_out'),
    adults: row.adults,
    children: row.children,
    currency: row.currency,
    finalAmountVnd: asBigIntAmount(row.final_amount_vnd),
    holdExpiresAt:
      row.hold_expires_at === null ? null : asDate(row.hold_expires_at, 'hold_expires_at'),
    accessPassVersion: row.access_pass_version,
    accessPassRevokedAt:
      row.access_pass_revoked_at === null
        ? null
        : asDate(row.access_pass_revoked_at, 'access_pass_revoked_at'),
    propertyCode: row.property_code,
    propertyName: row.property_name,
    propertyTimezone: row.property_timezone,
    roomTypeCode: row.room_type_code,
    roomTypeName: row.room_type_name,
    maxOccupancy: row.max_occupancy,
    fullName: row.full_name,
    normalizedEmail: row.normalized_email,
    normalizedPhoneE164: row.normalized_phone_e164,
    cancellationPolicySnapshot: row.cancellation_policy_snapshot,
    coupon: readCoupon(row),
  };
}

export class BookingDetailRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByBookingCodeForSession(
    bookingCode: string,
  ): Promise<BookingDetailRecord | null> {
    const result = await this.client.execute<DetailRow & Record<string, unknown>>(
      sql`SELECT b.id            AS booking_id,
                b.customer_user_id AS customer_user_id,
                b.property_id   AS property_id,
                b.room_type_id  AS room_type_id,
                b.booking_code  AS booking_code,
                b.status        AS status,
                b.check_in      AS check_in,
                b.check_out     AS check_out,
                b.adults        AS adults,
                b.children      AS children,
                b.currency      AS currency,
                b.final_amount_vnd AS final_amount_vnd,
                b.hold_expires_at  AS hold_expires_at,
                b.access_pass_version AS access_pass_version,
                b.access_pass_revoked_at AS access_pass_revoked_at,
                p.code          AS property_code,
                p.name          AS property_name,
                p.timezone      AS property_timezone,
                rt.code         AS room_type_code,
                rt.name         AS room_type_name,
                rt.max_occupancy AS max_occupancy,
                bc.full_name    AS full_name,
                bc.normalized_email AS normalized_email,
                bc.normalized_phone_e164 AS normalized_phone_e164,
                b.cancellation_policy_snapshot AS cancellation_policy_snapshot,
                bca.coupon_code_snapshot AS coupon_code,
                bca.discount_type   AS coupon_discount_type,
                bca.gross_amount_vnd AS coupon_gross_amount_vnd,
                bca.discount_amount_vnd AS coupon_discount_amount_vnd,
                bca.final_amount_vnd AS coupon_final_amount_vnd
           FROM bookings b
           JOIN properties p   ON p.id = b.property_id
           JOIN room_types rt  ON rt.property_id = b.property_id AND rt.id = b.room_type_id
           JOIN booking_contacts bc ON bc.booking_id = b.id
           LEFT JOIN booking_coupon_applications bca
                  ON bca.booking_id = b.id
                 AND bca.application_status IN ('ASSOCIATED', 'RESERVED', 'REDEEMED')
          WHERE b.booking_code = ${bookingCode}`,
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toBookingDetailRecord(row);
  }

  public async findAccessPassRecord(bookingId: string): Promise<BookingAccessPassRecord | null> {
    const result = await this.client.execute<
      {
        booking_id: string;
        booking_code: string;
        status: BookingDetailRecord['status'];
        access_pass_version: number;
        access_pass_revoked_at: Date | string | null;
      } & Record<string, unknown>
    >(
      sql`SELECT id AS booking_id,
                  booking_code,
                  status,
                  access_pass_version,
                  access_pass_revoked_at
             FROM bookings
            WHERE id = ${bookingId}`,
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      bookingId: row.booking_id,
      bookingCode: row.booking_code,
      status: row.status,
      accessPassVersion: row.access_pass_version,
      accessPassRevokedAt:
        row.access_pass_revoked_at === null
          ? null
          : asDate(row.access_pass_revoked_at, 'access_pass_revoked_at'),
    };
  }
}
