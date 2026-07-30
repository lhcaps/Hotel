import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

import type { DatabasePool } from '@room/database';
import { describe, expect, it, vi } from 'vitest';

import { renderAndSend } from '../../src/jobs/process-outbox.js';
import type { SMTPMessage, SMTPTransport } from '../../src/email/smtp-transport.js';

describe('coupon delivery outbox rendering', () => {
  it('sends only the stored delivery context and marks the request SENT without logging its recipient', async () => {
    const deliveryId = randomUUID();
    const eventId = randomUUID();
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            status: 'PENDING',
            normalized_email: 'guest@example.test',
            booking_code: 'BK-COUPON-1',
            property_name: 'Main property',
            coupon_codes: ['WELCOME10', 'STAY20'],
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const pool = { query } as unknown as DatabasePool;
    const sent: SMTPMessage[] = [];
    const transport: SMTPTransport = {
      send: async (message) => {
        sent.push(message);
      },
      close: async () => undefined,
    };
    const info = vi.fn();

    const result = await renderAndSend(
      transport,
      {
        id: eventId,
        aggregateType: 'COUPON_DELIVERY',
        aggregateId: deliveryId,
        eventType: 'coupon.delivery.requested',
        payload: { deliveryId },
        attemptCount: 1,
        leaseId: randomUUID(),
        leaseExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      },
      pool,
      'no-reply@room-management.local',
      Buffer.alloc(32),
      { info },
    );

    expect(result).toEqual({ outcome: 'sent', skipReason: null });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('guest@example.test');
    expect(sent[0]?.subject).toContain('BK-COUPON-1');
    expect(sent[0]?.text).toContain('STAY20');
    expect(query.mock.calls[1]?.[0]).toContain("SET status = 'SENT'");
    expect(info).toHaveBeenCalledWith(
      { eventId, eventType: 'coupon.delivery.requested', deliveryId },
      'Coupon delivery sent',
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain('guest@example.test');
  });

  it('does not re-send an already completed delivery', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          status: 'SENT',
          normalized_email: 'guest@example.test',
          booking_code: 'BK-COUPON-1',
          property_name: 'Main property',
          coupon_codes: ['WELCOME10'],
        },
      ],
    });
    const transport: SMTPTransport = { send: vi.fn(), close: async () => undefined };

    await expect(
      renderAndSend(
        transport,
        {
          id: randomUUID(),
          aggregateType: 'COUPON_DELIVERY',
          aggregateId: randomUUID(),
          eventType: 'coupon.delivery.requested',
          payload: { deliveryId: randomUUID() },
          attemptCount: 1,
          leaseId: randomUUID(),
          leaseExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
        },
        { query } as unknown as DatabasePool,
        'no-reply@room-management.local',
        Buffer.alloc(32),
        { info: vi.fn() },
      ),
    ).resolves.toEqual({ outcome: 'skipped', skipReason: 'ALREADY_SENT' });
    expect(transport.send).not.toHaveBeenCalled();
  });
});
