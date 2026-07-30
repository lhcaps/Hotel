import { describe, expect, it } from 'vitest';

import { buildOutboxMessageId } from '../../src/email/message-id.js';

describe('buildOutboxMessageId', () => {
  it('returns a deterministic value for the same outbox event id', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(buildOutboxMessageId(id)).toBe(buildOutboxMessageId(id));
  });

  it('produces different values for different outbox event ids', () => {
    expect(buildOutboxMessageId('00000000-0000-4000-8000-000000000001')).not.toBe(
      buildOutboxMessageId('00000000-0000-4000-8000-000000000002'),
    );
  });

  it('does not include the recipient address or booking code', () => {
    const id = '00000000-0000-4000-8000-000000000abc';
    const messageId = buildOutboxMessageId(id);
    expect(messageId).toBe(`<${id}@room-management.local>`);
    expect(messageId).not.toMatch(/guest|email|booking|@example|@.+\.com/);
  });

  it('rejects an empty outbox event id', () => {
    expect(() => buildOutboxMessageId('')).toThrow(/non-empty/);
  });
});
