import { setTimeout as wait } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  classifyError,
  emptyOutboxIterationSummary,
  processOutbox,
  type OutboxIterationSummary,
} from '../../src/jobs/process-outbox.js';
import {
  createSMTPTransport,
  type SMTPMessage,
  type SMTPTransport,
} from '../../src/email/smtp-transport.js';
import {
  createOutboxFixture,
  readOutboxEvent,
  seedBookingHold,
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

function createRecordingTransport(
  outcome: (message: SMTPMessage) => Promise<void> = async () => undefined,
): RecordingTransport {
  const messages: SMTPMessage[] = [];
  return {
    messages,
    send: async (message) => {
      await outcome(message);
      messages.push(message);
    },
    close: async () => undefined,
  };
}

function silentLogger() {
  return {
    info: () => undefined,
    warn: (_record: Record<string, unknown>) => undefined,
    error: () => undefined,
  };
}

const PROCESS_OPTIONS = {
  fromAddress: 'no-reply@room-management.local',
  batchSize: 10,
  leaseTtlMs: 30_000,
  baseBackoffMs: 1_000,
  maxBackoffMs: 5 * 60_000,
  otpSecret: Buffer.from('test-guest-otp-secret-32-chars-min-aaaaaa', 'utf8'),
};

describe('processOutbox', () => {
  it('publishes a happy-path hold-created event and returns the iteration summary', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      payload: {
        eventVersion: 1,
        bookingId: booking.bookingId,
        holdExpiresAt: '2027-01-10T03:45:00.000Z',
      },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());

    expect(summary).toEqual({
      claimed: 1,
      published: 1,
      skipped: 0,
      retryScheduled: 0,
      leaseLost: 0,
      failed: 0,
    });
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PUBLISHED');
    expect(transport.messages.length).toBe(1);
    expect(transport.messages[0]?.messageId).toBe(`<${eventId}@room-management.local>`);
  });

  it('delivers a reference-only issued access credential and records delivery', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      bookingStatus: 'CONFIRMED',
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const credentialId = randomUUID();
    const eventId = randomUUID();
    const issuedAt = new Date('2027-01-10T03:30:00.000Z');
    await pool.query(
      `INSERT INTO access_credentials
         (id, property_id, booking_id, room_id, provider, provider_credential_reference,
          status, valid_from, valid_until, issued_at, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'DEMO', $5, 'ISSUED', $6, $7, $6, $8, $6, $6)`,
      [
        credentialId,
        booking.propertyId,
        booking.bookingId,
        booking.roomId,
        'demo-provider-reference-must-never-reach-email',
        issuedAt,
        new Date('2027-01-10T07:00:00.000Z'),
        `access-credential:${booking.bookingId}`,
      ],
    );
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateType: 'ACCESS_CREDENTIAL',
      aggregateId: credentialId,
      eventType: 'access.credential.issued',
      payload: { eventVersion: 1, credentialId, bookingId: booking.bookingId, provider: 'DEMO' },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());

    expect(summary.published).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.to).toBe(booking.recipientEmail);
    expect(transport.messages[0]?.text).not.toContain('demo-provider-reference');
    const credential = await pool.query<{ status: string; delivered_at: Date | null }>(
      'SELECT status, delivered_at FROM access_credentials WHERE id = $1',
      [credentialId],
    );
    expect(credential.rows[0]?.status).toBe('DELIVERED');
    expect(credential.rows[0]?.delivered_at).toBeInstanceOf(Date);
  });

  it('skips a hold-created event when the booking is already EXPIRED', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
      bookingStatus: 'EXPIRED',
      expiredAt: new Date(),
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      payload: {
        eventVersion: 1,
        bookingId: booking.bookingId,
        holdExpiresAt: '2027-01-10T03:45:00.000Z',
      },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());

    expect(summary).toEqual({
      claimed: 1,
      published: 0,
      skipped: 1,
      retryScheduled: 0,
      leaseLost: 0,
      failed: 0,
    });
    expect(transport.messages.length).toBe(0);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PUBLISHED');
  });

  it('finalizes a hold-expired event as skipped (no email in deadline slice)', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.expired',
      payload: {
        eventVersion: 1,
        bookingId: booking.bookingId,
        expiredAt: '2027-01-10T03:45:00.000Z',
      },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());

    expect(summary.claimed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(transport.messages.length).toBe(0);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PUBLISHED');
  });

  it('attempts the second send on the second worker when the claim is lost', async () => {
    const fixture = await useFixture();
    const booking = await seedBookingHold(fixture.pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const eventId = randomUUID();
    await seedOutboxEvent(fixture.pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      payload: {
        eventVersion: 1,
        bookingId: booking.bookingId,
        holdExpiresAt: '2027-01-10T03:45:00.000Z',
      },
    });
    const secondPool = fixture.createPool('task6-process-worker-b');
    const transport = createRecordingTransport();

    const [summaryA, summaryB] = await Promise.all([
      processOutbox({ ...PROCESS_OPTIONS, pool: fixture.pool, transport }, silentLogger()),
      processOutbox({ ...PROCESS_OPTIONS, pool: secondPool, transport }, silentLogger()),
    ]);

    const total = summaryA.published + summaryB.published + summaryA.leaseLost + summaryB.leaseLost;
    expect(total).toBe(1);
    expect(transport.messages.length).toBeGreaterThanOrEqual(1);
    const row = await readOutboxEvent(fixture.pool, eventId);
    expect(row?.status).toBe('PUBLISHED');
  });

  it('reschedules with a safe category when SMTP fails', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      payload: {
        eventVersion: 1,
        bookingId: booking.bookingId,
        holdExpiresAt: '2027-01-10T03:45:00.000Z',
      },
    });
    const transport = createRecordingTransport(async () => {
      const error = new Error('connection reset');
      (error as { code?: string }).code = 'ECONNRESET';
      throw error;
    });

    const summary = await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());

    expect(summary.retryScheduled).toBe(1);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PENDING');
    expect(row?.lastErrorCategory).toBe('SMTP_CONNECT');
    expect(row?.leaseId).toBeNull();
  });

  it('skips an unknown event type without sending email or retrying forever', async () => {
    const { pool } = await useFixture();
    const booking = await seedBookingHold(pool, {
      contact: { normalizedEmail: 'guest@example.test' },
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.unknown.event' as unknown as 'booking.hold.created',
      payload: { eventVersion: 1, bookingId: booking.bookingId },
    });
    const transport = createRecordingTransport();

    const summary = await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());

    expect(summary.skipped).toBe(1);
    expect(transport.messages.length).toBe(0);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PUBLISHED');
  });

  it('returns a zero summary when no events are eligible', async () => {
    const { pool } = await useFixture();
    const transport = createRecordingTransport();
    const summary = await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());
    expect(summary).toEqual<OutboxIterationSummary>({
      claimed: 0,
      published: 0,
      skipped: 0,
      retryScheduled: 0,
      leaseLost: 0,
      failed: 0,
    });
    expect(summary).toEqual(emptyOutboxIterationSummary());
  });
});

describe('classifyError', () => {
  it('maps known error codes to the safe categories', () => {
    expect(classifyError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe(
      'SMTP_TIMEOUT',
    );
    expect(classifyError(Object.assign(new Error('x'), { code: 'ESOCKETTIMEDOUT' }))).toBe(
      'SMTP_TIMEOUT',
    );
    expect(classifyError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(
      'SMTP_CONNECT',
    );
    expect(classifyError(Object.assign(new Error('x'), { code: 'ENOTFOUND' }))).toBe(
      'SMTP_CONNECT',
    );
    expect(classifyError(Object.assign(new Error('x'), { code: 'ECONNRESET' }))).toBe(
      'SMTP_CONNECT',
    );
    expect(classifyError(Object.assign(new Error('x'), { code: 'EAUTH' }))).toBe('SMTP_REJECTED');
    expect(classifyError(Object.assign(new Error('x'), { code: 'EENVELOPE' }))).toBe(
      'SMTP_REJECTED',
    );
    expect(classifyError(new Error('Failed to render template'))).toBe('TEMPLATE_RENDER');
    expect(classifyError(new Error('unknown'))).toBe('SMTP_CONNECT');
  });
});

describe('Mailpit integration', () => {
  const mailpitHost = process.env.MAILPIT_HOST ?? '127.0.0.1';
  const mailpitSmtpPort = Number(process.env.MAILPIT_SMTP_PORT ?? 1025);
  const mailpitHttpPort = Number(process.env.MAILPIT_HTTP_PORT ?? 8025);

  let mailpitAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetch(`http://${mailpitHost}:${mailpitHttpPort}/api/v1/info`);
      mailpitAvailable = response.ok;
      if (mailpitAvailable) {
        await fetch(`http://${mailpitHost}:${mailpitHttpPort}/api/v1/messages`, {
          method: 'DELETE',
        });
      }
    } catch {
      mailpitAvailable = false;
    }
  });

  it('delivers a real email into Mailpit when the service is reachable', async () => {
    if (!mailpitAvailable) {
      return;
    }
    const { pool } = await useFixture();
    const token = `task6-${randomUUID().slice(0, 8)}`.toLowerCase();
    const booking = await seedBookingHold(pool, {
      contact: {
        fullName: 'Mailpit Guest',
        normalizedEmail: `${token}@example.test`,
      },
    });
    const eventId = randomUUID();
    await seedOutboxEvent(pool, {
      id: eventId,
      aggregateId: booking.bookingId,
      eventType: 'booking.hold.created',
      payload: {
        eventVersion: 1,
        bookingId: booking.bookingId,
        holdExpiresAt: '2027-01-10T03:45:00.000Z',
      },
    });
    const transport = createSMTPTransport(
      {
        host: mailpitHost,
        port: mailpitSmtpPort,
        secure: false,
        requireAuth: false,
      },
      await import('nodemailer'),
    );

    const summary = await processOutbox({ ...PROCESS_OPTIONS, pool, transport }, silentLogger());
    await transport.close();

    expect(summary.published).toBe(1);
    const row = await readOutboxEvent(pool, eventId);
    expect(row?.status).toBe('PUBLISHED');

    const found = await waitForMailpitMessage(mailpitHost, mailpitHttpPort, token);
    expect(found).not.toBeNull();
    expect(found?.MessageID).toBe(`${eventId}@room-management.local`);
  }, 20_000);
});

async function waitForMailpitMessage(
  host: string,
  port: number,
  token: string,
): Promise<{ ID: string; MessageID: string; To: { Address: string }[]; Subject: string } | null> {
  const upper = 25;
  for (let attempt = 0; attempt < upper; attempt += 1) {
    const list = await fetch(`http://${host}:${port}/api/v1/messages?limit=100`);
    if (list.ok) {
      const data = (await list.json()) as { messages?: Array<{ ID: string; MessageID: string }> };
      for (const summary of data.messages ?? []) {
        const detail = await fetch(`http://${host}:${port}/api/v1/message/${summary.ID}`);
        if (!detail.ok) continue;
        const body = (await detail.json()) as {
          ID: string;
          MessageID: string;
          To: { Address: string }[];
          Subject: string;
        };
        if (
          body.Subject.includes(token) ||
          body.To.some((recipient) => recipient.Address.includes(token.toLowerCase()))
        ) {
          return body;
        }
      }
    }
    await wait(200);
  }
  return null;
}
