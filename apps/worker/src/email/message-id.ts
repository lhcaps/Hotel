const MESSAGE_ID_DOMAIN = 'room-management.local';

export function buildOutboxMessageId(outboxEventId: string): string {
  if (typeof outboxEventId !== 'string' || outboxEventId.trim() === '') {
    throw new Error('buildOutboxMessageId requires a non-empty outbox event id');
  }
  return `<${outboxEventId}@${MESSAGE_ID_DOMAIN}>`;
}
