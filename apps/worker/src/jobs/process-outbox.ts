import { Buffer } from 'node:buffer';
import { type DatabasePool } from '@room/database';

import { claimOutboxBatch, type OutboxClaimRow } from '../outbox/claim-outbox-batch.js';
import {
  finalizeOutboxFailure,
  finalizeOutboxSuccess,
  type OutboxErrorCategory,
} from '../outbox/finalize-outbox.js';
import { buildBookingConfirmationMessageId, buildOutboxMessageId } from '../email/message-id.js';
import { type BookingHoldContext, type SkipReason } from '../email/skip-rules.js';
import { decideOtpSkip, type OtpChallengeLookupRow } from '../email/otp-skip-rules.js';
import { loadOtpContext } from '../email/otp-context.js';
import type { SMTPAttachment, SMTPMessage, SMTPTransport } from '../email/smtp-transport.js';
import { type HoldConfirmationContext } from '../email/templates/hold-confirmation.js';
import { renderOtpChallenge } from '../email/templates/otp-challenge.js';
import { renderCouponDelivery } from '../email/templates/coupon-delivery.js';
import { renderAccessCredentialDelivery } from '../email/templates/access-credential-delivery.js';
import {
  renderBookingConfirmation,
  type BookingConfirmationContext,
} from '../email/templates/booking-confirmation.js';
import {
  ArrivalAccessCrypto,
  BookingAccessPassService,
  deriveOtpForChallenge,
} from '@room/booking';

export interface ProcessOutboxOptions {
  readonly pool: DatabasePool;
  readonly transport: SMTPTransport;
  readonly fromAddress: string;
  readonly batchSize: number;
  readonly leaseTtlMs: number;
  readonly baseBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly otpSecret: Buffer;
  /** Present in the live worker to decrypt T-30 arrival configuration only at delivery time. */
  readonly arrivalAccessCrypto?: ArrivalAccessCrypto;
  /** Present in the live worker to attach the short-lived signed QR at T-30. */
  readonly bookingAccessPasses?: BookingAccessPassService;
}

export interface OutboxIterationSummary {
  readonly claimed: number;
  readonly published: number;
  readonly skipped: number;
  readonly retryScheduled: number;
  readonly leaseLost: number;
  readonly failed: number;
}

interface HoldConfirmationRow {
  readonly booking_code: string;
  readonly normalized_email: string | null;
  readonly full_name: string | null;
  readonly check_in: Date | string;
  readonly check_out: Date | string;
  readonly adults: number;
  readonly children: number;
  readonly hold_expires_at: Date | string;
  readonly booking_status: string;
  readonly property_name: string;
  readonly room_type_name: string;
  readonly final_amount_vnd: string;
  readonly currency: string;
}

export async function loadHoldConfirmationContext(
  pool: DatabasePool,
  bookingId: string,
): Promise<HoldConfirmationContext | null> {
  const result = await pool.query<HoldConfirmationRow>(
    `SELECT b.booking_code,
            bc.normalized_email,
            bc.full_name,
            b.check_in,
            b.check_out,
            b.adults,
            b.children,
            b.hold_expires_at,
            b.status AS booking_status,
            p.name AS property_name,
            rt.name AS room_type_name,
            b.final_amount_vnd::text AS final_amount_vnd,
            b.currency
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       JOIN room_types rt ON rt.property_id = b.property_id AND rt.id = b.room_type_id
       LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
      WHERE b.id = $1`,
    [bookingId],
  );
  const row = result.rows[0];
  if (row === undefined || row.normalized_email === null) {
    return null;
  }
  return {
    bookingCode: row.booking_code,
    holdExpiresAt: parseSqlTimestamp(row.hold_expires_at, 'hold_expires_at'),
    checkIn: parseSqlTimestamp(row.check_in, 'check_in'),
    checkOut: parseSqlTimestamp(row.check_out, 'check_out'),
    adults: row.adults,
    children: row.children,
    propertyName: row.property_name,
    roomTypeName: row.room_type_name,
    finalAmountVnd: Number(row.final_amount_vnd),
    currency: row.currency,
  };
}

interface BookingHoldRow {
  readonly booking_status: string;
  readonly contact_id: string | null;
  readonly check_in: Date | string;
  readonly check_out: Date | string;
  readonly hold_expires_at: Date | string;
}

export async function loadBookingHoldContext(
  pool: DatabasePool,
  bookingId: string,
): Promise<BookingHoldContext | null> {
  const result = await pool.query<BookingHoldRow>(
    `SELECT b.status AS booking_status,
            bc.id AS contact_id,
            b.check_in,
            b.check_out,
            b.hold_expires_at
       FROM bookings b
       LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
      WHERE b.id = $1`,
    [bookingId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    bookingStatus: row.booking_status,
    contactId: row.contact_id,
    checkIn: parseSqlTimestamp(row.check_in, 'check_in'),
    checkOut: parseSqlTimestamp(row.check_out, 'check_out'),
    holdExpiresAt: parseSqlTimestamp(row.hold_expires_at, 'hold_expires_at'),
  };
}

function parseSqlTimestamp(value: string | Date, field: string): Date {
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SQL timestamp for ${field}: ${String(value)}`);
  }
  return parsed;
}

export async function loadRecipientAddress(
  pool: DatabasePool,
  bookingId: string,
): Promise<string | null> {
  const result = await pool.query<{ normalized_email: string }>(
    `SELECT normalized_email FROM booking_contacts WHERE booking_id = $1`,
    [bookingId],
  );
  return result.rows[0]?.normalized_email ?? null;
}

export async function loadCurrentDatabaseTime(pool: DatabasePool): Promise<Date> {
  const result = await pool.query<{ database_now: Date | string }>(
    'SELECT CURRENT_TIMESTAMP AS database_now',
  );
  const value = result.rows[0]?.database_now;
  if (value === undefined) {
    throw new Error('PostgreSQL returned no authoritative timestamp');
  }
  return parseSqlTimestamp(value, 'database_now');
}

function extractBookingId(row: OutboxClaimRow): string | null {
  const payload = row.payload;
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const candidate = (payload as Record<string, unknown>).bookingId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

export interface RenderAndSendOutcome {
  readonly outcome: 'sent' | 'skipped';
  readonly skipReason: SkipReason | null;
}

export async function renderAndSend(
  transport: SMTPTransport,
  row: OutboxClaimRow,
  pool: DatabasePool,
  fromAddress: string,
  otpSecret: Buffer,
  logger: {
    info: (record: Record<string, unknown>, message: string) => void;
  },
  arrivalAccessCrypto?: ArrivalAccessCrypto,
  bookingAccessPasses?: BookingAccessPassService,
): Promise<RenderAndSendOutcome> {
  if (row.eventType === 'booking.hold.created') {
    return { outcome: 'skipped', skipReason: 'HOLD_EMAIL_DISABLED' };
  }
  if (row.eventType === 'booking.otp.requested') {
    return renderAndSendOtpChallenge(transport, row, pool, fromAddress, otpSecret, logger);
  }
  if (row.eventType === 'coupon.delivery.requested') {
    return renderAndSendCouponDelivery(transport, row, pool, fromAddress, logger);
  }
  if (row.eventType === 'booking.confirmed') {
    return renderAndSendBookingConfirmed(transport, row, pool, fromAddress, logger);
  }
  if (row.eventType === 'access.credential.issued') {
    return renderAndSendAccessCredentialDelivery(
      transport,
      row,
      pool,
      fromAddress,
      logger,
      arrivalAccessCrypto,
      bookingAccessPasses,
    );
  }
  return { outcome: 'skipped', skipReason: 'UNSUPPORTED_EVENT_TYPE' };
}

interface AccessCredentialDeliveryRow {
  readonly credential_status: 'PENDING' | 'ISSUED' | 'DELIVERED' | 'REVOKED' | 'FAILED';
  readonly booking_status: string;
  readonly booking_code: string;
  readonly access_pass_version: number;
  readonly check_out: Date | string;
  readonly normalized_email: string | null;
  readonly property_name: string;
  readonly property_id: string;
  readonly room_id: string;
  readonly gate_pass_encrypted: string | null;
  readonly wifi_ssid: string | null;
  readonly wifi_password_encrypted: string | null;
  readonly support_contact: string | null;
  readonly default_arrival_instruction: string | null;
  readonly preparation_note: string | null;
  readonly room_pass_encrypted: string | null;
  readonly room_location: string | null;
  readonly room_arrival_instruction: string | null;
}

function extractCredentialId(row: OutboxClaimRow): string | null {
  const payload = row.payload;
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const candidate = (payload as Record<string, unknown>).credentialId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

async function renderAndSendAccessCredentialDelivery(
  transport: SMTPTransport,
  row: OutboxClaimRow,
  pool: DatabasePool,
  fromAddress: string,
  logger: { info: (record: Record<string, unknown>, message: string) => void },
  arrivalAccessCrypto: ArrivalAccessCrypto | undefined,
  bookingAccessPasses: BookingAccessPassService | undefined,
): Promise<RenderAndSendOutcome> {
  const credentialId = extractCredentialId(row);
  const bookingId = extractBookingId(row);
  if (credentialId === null || bookingId === null) {
    return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  }

  const lookup = await pool.query<AccessCredentialDeliveryRow>(
    `SELECT ac.status AS credential_status,
            b.status AS booking_status,
            b.booking_code,
            b.access_pass_version,
            b.check_out,
            bc.normalized_email,
            p.name AS property_name,
            p.id AS property_id,
            b.room_id,
            pac.gate_pass_encrypted,
            pac.wifi_ssid,
            pac.wifi_password_encrypted,
            pac.support_contact,
            pac.default_arrival_instruction,
            pac.preparation_note,
            rac.room_pass_encrypted,
            rac.room_location,
            rac.arrival_instruction AS room_arrival_instruction
       FROM access_credentials ac
       JOIN bookings b ON b.id = ac.booking_id
       JOIN properties p ON p.id = ac.property_id
       LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
       LEFT JOIN property_arrival_access_configs pac ON pac.property_id = b.property_id
       LEFT JOIN room_arrival_access_configs rac ON rac.property_id = b.property_id AND rac.room_id = b.room_id
      WHERE ac.id = $1
        AND ac.booking_id = $2`,
    [credentialId, bookingId],
  );
  const context = lookup.rows[0];
  if (context === undefined || context.booking_status !== 'CONFIRMED') {
    return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  }
  if (context.credential_status === 'DELIVERED') {
    return { outcome: 'skipped', skipReason: 'ALREADY_SENT' };
  }
  if (context.credential_status !== 'ISSUED') {
    return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  }
  if (context.normalized_email === null) {
    return { outcome: 'skipped', skipReason: 'CONTACT_MISSING' };
  }
  const arrival = resolveArrivalDeliveryContext(context, arrivalAccessCrypto);
  if (arrival === null) {
    return { outcome: 'skipped', skipReason: 'ARRIVAL_CONFIG_INCOMPLETE' };
  }
  const qrAttachment = await createAccessQrAttachment(
    bookingAccessPasses,
    bookingId,
    context.access_pass_version,
    parseSqlTimestamp(context.check_out, 'check_out'),
    row.id,
  );
  const rendered = renderAccessCredentialDelivery({
    bookingCode: context.booking_code,
    propertyName: context.property_name,
    ...(arrival === undefined ? {} : { arrival }),
    ...(qrAttachment === undefined ? {} : { qrCid: qrAttachment.cid }),
  });

  await transport.send({
    from: fromAddress,
    to: context.normalized_email,
    ...rendered,
    messageId: buildOutboxMessageId(row.id),
    ...(qrAttachment === undefined ? {} : { attachments: [qrAttachment] }),
  });
  const delivered = await pool.query<{ id: string }>(
    `WITH delivered AS (
       UPDATE access_credentials
          SET status = 'DELIVERED',
              delivered_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND status = 'ISSUED'
      RETURNING id, property_id, booking_id, provider
     )
     INSERT INTO audit_events
       (property_id, aggregate_type, aggregate_id, event_type, actor_type, payload, occurred_at)
     SELECT property_id, 'ACCESS_CREDENTIAL', id, 'ACCESS_CREDENTIAL_DELIVERED', 'SYSTEM',
            jsonb_build_object(
              'eventVersion', 1,
              'bookingId', booking_id,
              'provider', provider,
              'deliveryChannel', 'EMAIL'
            ),
            CURRENT_TIMESTAMP
       FROM delivered
     RETURNING aggregate_id AS id`,
    [credentialId],
  );
  if (delivered.rows[0] === undefined) {
    return { outcome: 'skipped', skipReason: 'ALREADY_SENT' };
  }
  logger.info(
    { eventId: row.id, eventType: row.eventType, messageId: buildOutboxMessageId(row.id) },
    'Access credential delivery notification sent',
  );
  return { outcome: 'sent', skipReason: null };
}

async function createAccessQrAttachment(
  passes: BookingAccessPassService | undefined,
  bookingId: string,
  version: number,
  expiresAt: Date,
  eventId: string,
): Promise<SMTPAttachment | undefined> {
  // Unit-only callers may omit the signer. The live worker always supplies it.
  if (passes === undefined) return undefined;
  const pass = passes.issue({ bookingId, version, expiresAt });
  return {
    filename: 'peacenest-check-in-qr.png',
    content: await passes.toPng(pass),
    contentType: 'image/png',
    cid: `peacenest-check-in-${eventId}@mail`,
    contentDisposition: 'inline',
  };
}

function resolveArrivalDeliveryContext(
  context: AccessCredentialDeliveryRow,
  crypto: ArrivalAccessCrypto | undefined,
):
  | {
      readonly gatePass: string;
      readonly roomPass: string;
      readonly wifiSsid: string;
      readonly wifiPassword: string;
      readonly roomLocation: string;
      readonly instructions: string;
      readonly preparationNote: string;
      readonly supportContact: string;
    }
  | undefined
  | null {
  // Existing test harnesses may omit the crypto dependency. The production
  // worker always supplies it and consequently refuses unconfigured stays.
  if (crypto === undefined) return undefined;
  if (
    context.gate_pass_encrypted === null ||
    context.wifi_ssid === null ||
    context.wifi_password_encrypted === null ||
    context.support_contact === null ||
    context.default_arrival_instruction === null ||
    context.preparation_note === null ||
    context.room_pass_encrypted === null ||
    context.room_location === null
  ) {
    return null;
  }
  try {
    return {
      gatePass: crypto.decrypt(context.gate_pass_encrypted, {
        scope: 'property',
        id: context.property_id,
        field: 'gatePass',
      }),
      roomPass: crypto.decrypt(context.room_pass_encrypted, {
        scope: 'room',
        id: context.room_id,
        field: 'roomPass',
      }),
      wifiSsid: context.wifi_ssid,
      wifiPassword: crypto.decrypt(context.wifi_password_encrypted, {
        scope: 'property',
        id: context.property_id,
        field: 'wifiPassword',
      }),
      roomLocation: context.room_location,
      instructions: context.room_arrival_instruction ?? context.default_arrival_instruction,
      preparationNote: context.preparation_note,
      supportContact: context.support_contact,
    };
  } catch {
    return null;
  }
}

interface BookingConfirmationRow {
  readonly booking_code: string;
  readonly booking_status: string;
  readonly normalized_email: string | null;
  readonly full_name: string | null;
  readonly check_in: Date | string;
  readonly check_out: Date | string;
  readonly adults: number;
  readonly children: number;
  readonly updated_at: Date | string;
  readonly property_name: string;
  readonly room_type_name: string;
  readonly final_amount_vnd: string;
  readonly currency: string;
  readonly provider: 'MOMO' | 'VNPAY' | null;
}

export async function loadBookingConfirmationContext(
  pool: DatabasePool,
  bookingId: string,
): Promise<BookingConfirmationContext | null> {
  const result = await pool.query<BookingConfirmationRow>(
    `SELECT b.booking_code,
            b.status AS booking_status,
            bc.normalized_email,
            bc.full_name,
            b.check_in,
            b.check_out,
            b.adults,
            b.children,
            b.updated_at,
            p.name AS property_name,
            rt.name AS room_type_name,
            b.final_amount_vnd::text AS final_amount_vnd,
            b.currency,
            (SELECT pa.provider
               FROM payment_attempts pa
               JOIN payments pay ON pay.id = pa.payment_id
              WHERE pay.booking_id = b.id
                AND pa.status = 'SUCCEEDED'
              ORDER BY pa.completed_at DESC NULLS LAST
              LIMIT 1) AS provider
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       JOIN room_types rt ON rt.property_id = b.property_id AND rt.id = b.room_type_id
       LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
      WHERE b.id = $1`,
    [bookingId],
  );
  const row = result.rows[0];
  if (row === undefined || row.normalized_email === null || row.provider === null) {
    return null;
  }
  if (row.booking_status !== 'CONFIRMED') {
    return null;
  }
  return {
    bookingCode: row.booking_code,
    propertyName: row.property_name,
    roomTypeName: row.room_type_name,
    checkIn: parseSqlTimestamp(row.check_in, 'check_in'),
    checkOut: parseSqlTimestamp(row.check_out, 'check_out'),
    adults: row.adults,
    children: row.children,
    finalAmountVnd: Number(row.final_amount_vnd),
    currency: row.currency,
    provider: row.provider,
    confirmedAt: parseSqlTimestamp(row.updated_at, 'updated_at'),
  };
}

async function renderAndSendBookingConfirmed(
  transport: SMTPTransport,
  row: OutboxClaimRow,
  pool: DatabasePool,
  fromAddress: string,
  logger: {
    info: (record: Record<string, unknown>, message: string) => void;
  },
): Promise<RenderAndSendOutcome> {
  const bookingId = extractBookingId(row);
  if (bookingId === null) {
    return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  }
  const context = await loadBookingConfirmationContext(pool, bookingId);
  if (context === null) {
    return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  }
  const recipient = await loadRecipientAddress(pool, bookingId);
  if (recipient === null) {
    return { outcome: 'skipped', skipReason: 'CONTACT_MISSING' };
  }
  const messageId = buildBookingConfirmationMessageId(bookingId);
  const reserved = await reserveBookingConfirmationDelivery(pool, bookingId, messageId);
  if (!reserved) {
    return { outcome: 'skipped', skipReason: 'ALREADY_SENT' };
  }
  const rendered = renderBookingConfirmation(context);
  const finalMessage: SMTPMessage = {
    from: fromAddress,
    to: recipient,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    messageId,
  };
  try {
    await transport.send(finalMessage);
    const delivered = await markBookingConfirmationDelivered(pool, bookingId, messageId);
    if (!delivered) {
      throw new Error(
        'Booking confirmation delivery reservation was not available for finalization',
      );
    }
  } catch (error) {
    await releaseBookingConfirmationDelivery(pool, bookingId, messageId).catch(() => undefined);
    throw error;
  }
  logger.info(
    {
      eventId: row.id,
      eventType: row.eventType,
      messageId,
      bookingCode: context.bookingCode,
      provider: context.provider,
    },
    'Booking confirmation email sent',
  );
  return { outcome: 'sent', skipReason: null };
}

async function reserveBookingConfirmationDelivery(
  pool: DatabasePool,
  bookingId: string,
  messageId: string,
): Promise<boolean> {
  const result = await pool.query<{ booking_id: string }>(
    `INSERT INTO booking_confirmation_deliveries
       (booking_id, status, message_id, created_at, updated_at)
     VALUES ($1, 'PENDING', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (booking_id) DO NOTHING
     RETURNING booking_id`,
    [bookingId, messageId],
  );
  return result.rows[0] !== undefined;
}

async function markBookingConfirmationDelivered(
  pool: DatabasePool,
  bookingId: string,
  messageId: string,
): Promise<boolean> {
  const result = await pool.query<{ booking_id: string }>(
    `UPDATE booking_confirmation_deliveries
        SET status = 'DELIVERED',
            delivered_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE booking_id = $1
        AND message_id = $2
        AND status = 'PENDING'
      RETURNING booking_id`,
    [bookingId, messageId],
  );
  return result.rows[0] !== undefined;
}

async function releaseBookingConfirmationDelivery(
  pool: DatabasePool,
  bookingId: string,
  messageId: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM booking_confirmation_deliveries
      WHERE booking_id = $1
        AND message_id = $2
        AND status = 'PENDING'`,
    [bookingId, messageId],
  );
}

async function renderAndSendCouponDelivery(
  transport: SMTPTransport,
  row: OutboxClaimRow,
  pool: DatabasePool,
  fromAddress: string,
  logger: { info: (record: Record<string, unknown>, message: string) => void },
): Promise<RenderAndSendOutcome> {
  const payload = row.payload;
  const deliveryId =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>).deliveryId
      : undefined;
  if (typeof deliveryId !== 'string') return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  const result = await pool.query<{
    status: 'PENDING' | 'SENT';
    normalized_email: string;
    booking_code: string;
    property_name: string;
    coupon_codes: string[];
  }>(
    `SELECT d.status, bc.normalized_email, b.booking_code, p.name AS property_name, d.coupon_codes
       FROM coupon_delivery_requests d JOIN bookings b ON b.id = d.booking_id
       JOIN booking_contacts bc ON bc.booking_id = b.id JOIN properties p ON p.id = d.property_id WHERE d.id = $1`,
    [deliveryId],
  );
  const delivery = result.rows[0];
  if (delivery === undefined) return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  if (delivery.status === 'SENT') return { outcome: 'skipped', skipReason: 'ALREADY_SENT' };
  const rendered = renderCouponDelivery({
    bookingCode: delivery.booking_code,
    propertyName: delivery.property_name,
    couponCodes: delivery.coupon_codes,
  });
  await transport.send({
    from: fromAddress,
    to: delivery.normalized_email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    messageId: buildOutboxMessageId(row.id),
  });
  await pool.query(
    `UPDATE coupon_delivery_requests SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'PENDING'`,
    [deliveryId],
  );
  logger.info({ eventId: row.id, eventType: row.eventType, deliveryId }, 'Coupon delivery sent');
  return { outcome: 'sent', skipReason: null };
}

async function renderAndSendOtpChallenge(
  transport: SMTPTransport,
  row: OutboxClaimRow,
  pool: DatabasePool,
  fromAddress: string,
  otpSecret: Buffer,
  logger: {
    info: (record: Record<string, unknown>, message: string) => void;
  },
): Promise<RenderAndSendOutcome> {
  const payload = row.payload;
  if (typeof payload !== 'object' || payload === null) {
    return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  }
  const bookingId = (payload as Record<string, unknown>).bookingId;
  const challengeId = (payload as Record<string, unknown>).challengeId;
  if (typeof bookingId !== 'string' || typeof challengeId !== 'string') {
    return { outcome: 'skipped', skipReason: 'CONTEXT_MISSING' };
  }

  const currentTime = await loadCurrentDatabaseTime(pool);
  const otpRow = await loadOtpContextRow(pool, bookingId, challengeId);
  if (otpRow === null) {
    return { outcome: 'skipped', skipReason: 'CHALLENGE_GONE' };
  }
  const skipDecision = decideOtpSkip(otpRow, currentTime);
  if (skipDecision.skip) {
    return { outcome: 'skipped', skipReason: skipDecision.reason };
  }

  const context = await loadOtpContext(pool, bookingId, challengeId);
  if (context === null) {
    return { outcome: 'skipped', skipReason: 'CHALLENGE_GONE' };
  }

  const recipient = await loadRecipientAddress(pool, bookingId);
  if (recipient === null) {
    return { outcome: 'skipped', skipReason: 'CONTACT_GONE' };
  }

  const otp = deriveOtpForChallenge(otpSecret, context.nonce);
  const rendered = renderOtpChallenge({
    bookingCode: context.bookingCode,
    otp,
    expiresAt: context.expiresAt,
  });
  const messageId = buildOutboxMessageId(row.id);
  const finalMessage: SMTPMessage = {
    from: fromAddress,
    to: recipient,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    messageId,
  };
  await transport.send(finalMessage);
  logger.info(
    { eventId: row.id, eventType: row.eventType, messageId, bookingCode: context.bookingCode },
    'Outbox SMTP message sent',
  );
  return { outcome: 'sent', skipReason: null };
}

interface OtpLookupRow extends OtpChallengeLookupRow {
  readonly booking_id: string;
}

async function loadOtpContextRow(
  pool: DatabasePool,
  bookingId: string,
  challengeId: string,
): Promise<OtpLookupRow | null> {
  const result = await pool.query<OtpLookupRow>(
    `SELECT goc.id            AS challenge_id,
            goc.booking_id    AS booking_id,
            goc.email_digest  AS email_digest,
            goc.attempts      AS attempts,
            goc.max_attempts  AS max_attempts,
            goc.expires_at    AS expires_at,
            goc.consumed_at   AS consumed_at,
            goc.replaced_at   AS replaced_at,
            b.status          AS booking_status,
            bc.email_digest   AS contact_email_digest
       FROM guest_otp_challenges goc
       JOIN bookings b          ON b.id = goc.booking_id
       LEFT JOIN booking_contacts bc ON bc.booking_id = b.id
      WHERE goc.id = $1
        AND goc.booking_id = $2`,
    [challengeId, bookingId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return row;
}

export function emptyOutboxIterationSummary(): OutboxIterationSummary {
  return {
    claimed: 0,
    published: 0,
    skipped: 0,
    retryScheduled: 0,
    leaseLost: 0,
    failed: 0,
  };
}

export function classifyError(error: unknown): OutboxErrorCategory {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
      return 'SMTP_TIMEOUT';
    }
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
      return 'SMTP_CONNECT';
    }
    if (code === 'EENVELOPE' || code === 'EAUTH') {
      return 'SMTP_REJECTED';
    }
    if (error.message.startsWith('Failed to render')) {
      return 'TEMPLATE_RENDER';
    }
  }
  return 'SMTP_CONNECT';
}

export async function processOutbox(
  options: ProcessOutboxOptions,
  logger: {
    info: (record: Record<string, unknown>, message: string) => void;
    warn: (record: Record<string, unknown>, message: string) => void;
    error: (record: Record<string, unknown>, message: string) => void;
  },
): Promise<OutboxIterationSummary> {
  const claims = await claimOutboxBatch({
    pool: options.pool,
    batchSize: options.batchSize,
    leaseTtlMs: options.leaseTtlMs,
  });

  const counter = {
    claimed: claims.length,
    published: 0,
    skipped: 0,
    retryScheduled: 0,
    leaseLost: 0,
    failed: 0,
  };

  for (const claim of claims) {
    try {
      const result = await renderAndSend(
        options.transport,
        claim,
        options.pool,
        options.fromAddress,
        options.otpSecret,
        logger,
        options.arrivalAccessCrypto,
        options.bookingAccessPasses,
      );
      const finalize = await finalizeOutboxSuccess({
        pool: options.pool,
        claim,
      });
      if (finalize.updated || finalize.alreadyPublished) {
        if (result.outcome === 'sent') {
          counter.published += 1;
        } else {
          counter.skipped += 1;
        }
      } else {
        counter.leaseLost += 1;
      }
    } catch (error) {
      const category = classifyError(error);
      const failure = await finalizeOutboxFailure({
        pool: options.pool,
        claim,
        category,
        baseBackoffMs: options.baseBackoffMs,
        maxBackoffMs: options.maxBackoffMs,
      }).catch(() => ({ updated: false, rescheduledAt: null }));
      if (failure.updated) {
        counter.retryScheduled += 1;
      } else {
        counter.leaseLost += 1;
      }
      logger.warn(
        {
          eventId: claim.id,
          eventType: claim.eventType,
          category,
          message: error instanceof Error ? error.message : 'unknown',
        },
        'Outbox delivery failed',
      );
    }
  }

  return {
    claimed: counter.claimed,
    published: counter.published,
    skipped: counter.skipped,
    retryScheduled: counter.retryScheduled,
    leaseLost: counter.leaseLost,
    failed: counter.failed,
  };
}
