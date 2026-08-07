import { auditEvents, outboxEvents, type DatabaseClient } from '@room/database';

type EventDatabase = Pick<DatabaseClient, 'insert'>;

function databaseFor(transaction: unknown): EventDatabase {
  return transaction as EventDatabase;
}

export type PricingPolicyEventType =
  | 'PRICING_POLICY_DRAFT_CREATED'
  | 'PRICING_POLICY_DRAFT_BOOTSTRAPPED'
  | 'PRICING_POLICY_DRAFT_UPDATED'
  | 'PRICING_POLICY_DRAFT_CANCELLED'
  | 'PRICING_POLICY_PREVIEWED'
  | 'PRICING_POLICY_PUBLISHED'
  | 'PRICING_POLICY_SUPERSEDED'
  | 'PRICING_POLICY_RETIRED';

export interface PricingPolicyEvent {
  readonly propertyId: string;
  readonly policyId: string;
  readonly eventType: PricingPolicyEventType;
  readonly actorId: string;
  readonly requestId: string;
  readonly correlationId: string | null;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
}

export class PricingPolicyEventWriter {
  public async write(transaction: unknown, event: PricingPolicyEvent): Promise<void> {
    const database = databaseFor(transaction);
    const payload = {
      ...event.payload,
      requestId: event.requestId,
      ...(event.correlationId === null ? {} : { correlationId: event.correlationId }),
    };
    await database.insert(auditEvents).values({
      propertyId: event.propertyId,
      aggregateType: 'PRICING_POLICY',
      aggregateId: event.policyId,
      eventType: event.eventType,
      actorType: 'ADMIN',
      actorId: event.actorId,
      payload,
    });
    await database.insert(outboxEvents).values({
      propertyId: event.propertyId,
      aggregateType: 'PRICING_POLICY',
      aggregateId: event.policyId,
      eventType: event.eventType,
      payload,
      status: 'PENDING',
    });
  }
}
