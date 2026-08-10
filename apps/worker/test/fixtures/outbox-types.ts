export interface OutboxEventSeed {
  readonly id: string;
  readonly aggregateId: string;
  readonly aggregateType?: 'BOOKING' | 'ACCESS_CREDENTIAL';
  readonly eventType:
    | 'booking.hold.created'
    | 'booking.hold.expired'
    | 'booking.otp.requested'
    | 'access.credential.issued';
  readonly availableAt?: Date;
  readonly leaseId?: string | null;
  readonly claimedAt?: Date | null;
  readonly leaseExpiresAt?: Date | null;
  readonly attemptCount?: number;
  readonly status?: 'PENDING' | 'PUBLISHED' | 'FAILED';
  readonly publishedAt?: Date | null;
  readonly lastErrorCategory?: string | null;
  readonly payload?: Record<string, unknown>;
}
