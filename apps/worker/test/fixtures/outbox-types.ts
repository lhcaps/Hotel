export interface OutboxEventSeed {
  readonly id: string;
  readonly aggregateId: string;
  readonly eventType:
    | 'booking.hold.created'
    | 'booking.hold.expired'
    | 'booking.otp.requested';
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
