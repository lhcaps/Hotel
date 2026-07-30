import { auditEvents, type DatabaseClient } from '@room/database';

import type { CustomerAuditRecorder } from './customer-profile.service.js';

/**
 * Thin adapter that maps CUSTOMER profile mutations to the audit log.
 * Payload contains only field names that changed — never phone numbers,
 * addresses, or emails.
 */
export class CustomerAuditAdapter implements CustomerAuditRecorder {
  public constructor(private readonly database: DatabaseClient) {}

  public async write(input: {
    propertyId: string | null;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    actorType: 'CUSTOMER' | 'GUEST' | 'ADMIN' | 'SYSTEM';
    actorId: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.database.insert(auditEvents).values({
      propertyId: input.propertyId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId,
      payload: input.payload,
    });
  }
}
