import type {
  PaymentProvider,
  PaymentProviderQueryResult,
  QueryTransactionStatusRequest,
  VerifiedPaymentProviderEvent,
} from './types.js';

export interface CreateProviderCheckoutRequest {
  readonly merchantOrderId: string;
  readonly amountVnd: bigint;
  readonly currency: 'VND';
  readonly returnUrl: string;
  readonly webhookUrl: string;
  readonly description: string;
  readonly expiresAt: Date;
}

export interface CreateProviderCheckoutResult {
  readonly providerOrderId: string;
  readonly redirectUrl: string;
  readonly expiresAt: Date;
  readonly providerResponseCode?: string;
}

export interface VerifyProviderWebhookRequest {
  readonly rawBody: Buffer;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly receivedAt: Date;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createCheckout(request: CreateProviderCheckoutRequest): Promise<CreateProviderCheckoutResult>;
  verifyAndNormalizeWebhook(
    request: VerifyProviderWebhookRequest,
  ): Promise<VerifiedPaymentProviderEvent>;
  /**
   * Pull the provider's authoritative view of a payment attempt and return a
   * canonical discriminated union the booking core can act on without parsing
   * provider-specific payloads. The adapter MUST:
   *   - reject any cross-order, cross-amount, or cross-currency mismatch,
   *   - apply a provider-mandated minimum timeout,
   *   - raise a typed NETWORK / CONFIG / PROVIDER error on failure paths so
   *     callers can distinguish transient from structural causes,
   *   - keep webhook / browser-return behavior untouched.
   */
  queryTransactionStatus(
    request: QueryTransactionStatusRequest,
  ): Promise<PaymentProviderQueryResult>;
}
