export type PaymentProvider = 'MOMO' | 'VNPAY';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'REVIEW_REQUIRED' | 'CANCELLED' | 'EXPIRED';
export type PaymentAttemptStatus =
  'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REVIEW_REQUIRED';
export type PaymentNormalizedOutcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface VerifiedPaymentProviderEvent {
  readonly provider: PaymentProvider;
  readonly eventKey: string;
  readonly providerOrderId: string;
  readonly providerTransactionId: string | null;
  readonly normalizedOutcome: PaymentNormalizedOutcome;
  readonly amountVnd: bigint | null;
  readonly currency: 'VND' | string | null;
  readonly occurredAt: Date;
  readonly rawBodyDigest: Buffer;
  readonly verificationMarker: 'VERIFIED_BY_ADAPTER';
}

/**
 * Canonical inputs the booking core hands to a provider adapter when it
 * needs an authoritative status pull. Order-scoped invariants (currency,
 * amount, provider, merchant order identity) are enforced by the adapter
 * before the provider payload is parsed.
 */
export interface QueryTransactionStatusRequest {
  readonly merchantOrderId: string;
  readonly providerOrderId: string;
  readonly amountVnd: bigint;
  readonly currency: 'VND';
  /**
   * Caller-provided AbortSignal honored by the adapter before any outbound
   * HTTP attempt. The adapter layers its own minimum timeout on top so the
   * provider never sees a value below the floor enforced for that provider.
   */
  readonly signal?: AbortSignal;
  readonly now?: Date;
}

/**
 * Discriminated union returned by every provider adapter's status-query
 * implementation. Booking core uses this single shape to:
 *   - VERIFIED_EVENT  -> replay through the existing applyVerifiedPaymentEvent path
 *   - PENDING         -> mark the attempt as still in flight (do not settle)
 *   - NOT_FOUND       -> surface provider-level "unknown order" to the caller
 *
 * The discriminator `kind` is the only field core is allowed to switch on.
 * Provider-specific payload fields must never escape the adapter.
 */
export type PaymentProviderQueryResult =
  | {
      readonly kind: 'VERIFIED_EVENT';
      readonly event: VerifiedPaymentProviderEvent;
    }
  | {
      readonly kind: 'PENDING';
      readonly providerOrderId: string;
      readonly rawProviderCode: string | null;
    }
  | {
      readonly kind: 'NOT_FOUND';
      readonly providerOrderId: string;
      readonly rawProviderCode: string | null;
    };
