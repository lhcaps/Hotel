import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { afterEach, describe, expect, it } from 'vitest';

import { processOutbox } from '../../src/jobs/process-outbox.js';
import type { SMTPMessage, SMTPTransport } from '../../src/email/smtp-transport.js';
import { deriveOtpForChallenge } from '@room/booking';

import {
  createOutboxFixture,
  readOutboxEvent,
  seedBookingHold,
  seedOtpChallenge,
  seedOutboxEvent,
  type OutboxFixture,
} from '../fixtures/outbox-fixtures.js';

let fixture: OutboxFixture | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

async function useFixture(): Promise<OutboxFixture> {
  fixture = await createOutboxFixture();
  return fixture;
}

interface RecordingTransport extends SMTPTransport {
  readonly messages: SMTPMessage[];
}

function createRecordingTransport(): RecordingTransport {
  const messages: SMTPMessage[] = [];
  return {
    messages,
    send: async (message) => {
      messages.push(message);
    },
    close: async () => undefined,
  };
}

function silentLogger() {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

const OTP_SECRET = Buffer.from('test-guest-otp-secret-32-chars-min-aaaaaa', 'utf8');

const PROCESS_OPTIONS = {
  fromAddress: 'no-reply@room-management.local',
  batchSize: 10,
  leaseTtlMs: 30_000,
  baseBackoffMs: 1_000,
  maxBackoffMs: 5 * 60_000,
  otpSecret: OTP_SECRET,
};

describe('processOutbox — booking.otp.requested', () => {
  it('delivers an active challenge and emits exactly one Mailpit-bound email', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const nonce = Buffer.alloc(32, 0x11);
    const challengeId = await seedOtpChallenge(pool, {
      bookingId: booking.bookingId,
      nonce,
      expiresAt: new Date('2027-01-10T03:50:00.000Z'),
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.otp.requested',
      payload: {
        eventVersion: 1,
        bookingId: booking.bookingId,
        challengeId,
      },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox(
      { ...PROCESS_OPTIONS, pool, transport },
      silentLogger(),
    );

    expect(summary.published).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(transport.messages).toHaveLength(1);

    const message = transport.messages[0];
    if (message === undefined) {
      throw new Error('Expected transport to have at least one message');
    }
    expect(message.to).toBe('guest@example.test');
    expect(message.subject).toContain('verification code');
    expect(message.messageId).toBe(`<${eventId}@room-management.local>`);

    const expectedOtp = deriveOtpForChallenge(OTP_SECRET, nonce);
    expect(message.text).toContain(expectedOtp);
    expect(message.html).toContain(expectedOtp);

    const finalRow = await readOutboxEvent(pool, eventId);
    expect(finalRow?.status).toBe('PUBLISHED');
  });

  it('does not include the recipient email in the log payload', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const challengeId = await seedOtpChallenge(pool, {
      bookingId: booking.bookingId,
      expiresAt: new Date('2027-01-10T03:50:00.000Z'),
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.otp.requested',
      payload: { eventVersion: 1, bookingId: booking.bookingId, challengeId },
    });
    const transport = createRecordingTransport();
    const captured: Array<Record<string, unknown>> = [];
    const logger = {
      info: (record: Record<string, unknown>) => captured.push(record),
      warn: () => undefined,
      error: () => undefined,
    };

    await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, logger);

    for (const record of captured) {
      const serialized = JSON.stringify(record);
      expect(serialized).not.toContain('guest@example.test');
      // booking codes contain 6 hex-ish characters (e.g. "AB23CD45EF67");
      // OTP is exactly six digits with no surrounding dashes/formatting.
      // Booking codes / eventIds / messageIds use UUID hex (lowercase or
      // uppercase), so the boundary is any non-hex character.
      expect(serialized).not.toMatch(/(^|[^A-Za-z0-9])[0-9]{6}([^0-9]|$)/);
    }
  });

  it('does not persist the derived OTP in any database column', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const nonce = Buffer.alloc(32, 0x99);
    const challengeId = await seedOtpChallenge(pool, {
      bookingId: booking.bookingId,
      nonce,
      expiresAt: new Date('2027-01-10T03:50:00.000Z'),
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.otp.requested',
      payload: { eventVersion: 1, bookingId: booking.bookingId, challengeId },
    });
    const transport = createRecordingTransport();
    const expectedOtp = deriveOtpForChallenge(OTP_SECRET, nonce);

    await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());

    const payload = await pool.query<{ payload: Record<string, unknown> }>(
      'SELECT payload FROM outbox_events WHERE id = $1',
      [eventId],
    );
    const serialized = JSON.stringify(payload.rows[0]?.payload);
    expect(serialized).not.toContain(expectedOtp);
    expect(serialized).not.toContain('otp');

    const allOutbox = await pool.query<{ payload: Record<string, unknown> }>(
      "SELECT payload FROM outbox_events WHERE event_type = 'booking.otp.requested'",
    );
    for (const row of allOutbox.rows) {
      expect(JSON.stringify(row.payload)).not.toContain(expectedOtp);
    }
  });

  it('skips a consumed challenge terminally (no retry)', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const challengeId = await seedOtpChallenge(pool, {
      bookingId: booking.bookingId,
      consumedAt: new Date('2027-01-09T12:00:00.000Z'),
      expiresAt: new Date('2027-01-10T03:50:00.000Z'),
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.otp.requested',
      payload: { eventVersion: 1, bookingId: booking.bookingId, challengeId },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox(
      { ...PROCESS_OPTIONS, pool, transport },
      silentLogger(),
    );

    expect(summary.skipped).toBe(1);
    expect(summary.published).toBe(0);
    expect(transport.messages).toHaveLength(0);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PUBLISHED'); // terminally published to stop retries
  });

  it('skips a replaced challenge terminally', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const challengeId = await seedOtpChallenge(pool, {
      bookingId: booking.bookingId,
      replacedAt: new Date('2027-01-09T12:00:00.000Z'),
      expiresAt: new Date('2027-01-10T03:50:00.000Z'),
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.otp.requested',
      payload: { eventVersion: 1, bookingId: booking.bookingId, challengeId },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox(
      { ...PROCESS_OPTIONS, pool, transport },
      silentLogger(),
    );

    expect(summary.skipped).toBe(1);
    expect(transport.messages).toHaveLength(0);
  });

  it('skips an expired challenge terminally', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    // Seed the challenge with an explicit past createdAt so the
    // expires_at > created_at CHECK still holds while the expires_at is
    // already in the past relative to the current time.
    const createdAt = new Date(Date.now() - 600_000);
    const expiresAt = new Date(createdAt.getTime() + 1_000); // already expired
    const challengeId = await seedOtpChallenge(pool, {
      bookingId: booking.bookingId,
      expiresAt,
      createdAt,
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.otp.requested',
      payload: { eventVersion: 1, bookingId: booking.bookingId, challengeId },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox(
      { ...PROCESS_OPTIONS, pool, transport },
      silentLogger(),
    );

    expect(summary.skipped).toBe(1);
    expect(transport.messages).toHaveLength(0);
  });

  it('skips when the email digest does not match the contact digest', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const challengeId = await seedOtpChallenge(pool, {
      bookingId: booking.bookingId,
      emailDigest: Buffer.alloc(32, 0xff), // mismatch with contact digest (0x01)
      expiresAt: new Date('2027-01-10T03:50:00.000Z'),
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.otp.requested',
      payload: { eventVersion: 1, bookingId: booking.bookingId, challengeId },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox(
      { ...PROCESS_OPTIONS, pool, transport },
      silentLogger(),
    );

    expect(summary.skipped).toBe(1);
    expect(transport.messages).toHaveLength(0);
  });

  it('skips when the booking is in EXPIRED state', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      bookingStatus: 'EXPIRED',
      expiredAt: new Date('2026-01-01T00:00:00.000Z'),
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const challengeId = await seedOtpChallenge(pool, {
      bookingId: booking.bookingId,
      expiresAt: new Date('2027-01-10T03:50:00.000Z'),
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.otp.requested',
      payload: { eventVersion: 1, bookingId: booking.bookingId, challengeId },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox(
      { ...PROCESS_OPTIONS, pool, transport },
      silentLogger(),
    );

    expect(summary.skipped).toBe(1);
    expect(transport.messages).toHaveLength(0);
  });
});
