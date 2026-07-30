import { auditEvents, type DatabaseClient } from '@room/database';

import type { AuditRepositoryPort } from './catalog.service.js';

type AuditDatabase = Pick<DatabaseClient, 'insert'>;

function asAuditDatabase(transaction: unknown): AuditDatabase {
  return transaction as AuditDatabase;
}

export class AuditRepository implements AuditRepositoryPort {
  public async write(
    transaction: unknown,
    event: Parameters<AuditRepositoryPort['write']>[1],
  ): Promise<void> {
    await asAuditDatabase(transaction).insert(auditEvents).values({
      propertyId: event.propertyId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      actorType: 'ADMIN',
      actorId: event.actorId,
      payload: event.payload,
    });
  }
}
