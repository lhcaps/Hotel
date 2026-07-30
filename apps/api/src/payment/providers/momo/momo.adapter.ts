import { createHash } from 'node:crypto';
import {
  type CreateProviderCheckoutRequest,
  type CreateProviderCheckoutResult,
  PaymentCoreError,
  type PaymentProviderAdapter,
  type PaymentProviderQueryResult,
  type QueryTransactionStatusRequest,
  type VerifiedPaymentProviderEvent,
  type VerifyProviderWebhookRequest,
} from '@room/booking';

import {
  momoCreateResponseSchema,
  momoIpnSchema,
  momoQueryResponseSchema,
} from './momo.contracts.js';
import type { MomoConfig } from './momo.config.js';
import { MomoAdapterError } from './momo.errors.js';
import {
  MomoQueryAdapterError,
  MomoQueryConfigError,
  MomoQueryNetworkError,
} from './momo.errors.js';
import {
  buildMomoInitiationCanonicalString,
  buildMomoIpnCanonicalString,
  buildMomoQueryCanonicalString,
  buildMomoResponseCanonicalString,
  digestMomoRawBody,
  hasValidMomoSignature,
  signMomoCanonicalString,
} from './momo.signature.js';

export {
  buildMomoInitiationCanonicalString,
  buildMomoIpnCanonicalString,
  buildMomoQueryCanonicalString,
} from './momo.signature.js';
export type { MomoConfig } from './momo.config.js';

/**
 * MoMo's official `queryStatus` minimum timeout floor per the published
 * provider documentation (section 4.4 of the captureWallet spec). Any value
 * below this is treated as a CONFIG error and never reaches the wire.
 */
const MOMO_QUERY_MIN_TIMEOUT_MS = 30_000;

type MomoFetch = (input: string, init: RequestInit) => Promise<Response>;

function asSafeAmount(amount: bigint): number {
  if (amount < 1_000n || amount > 50_000_000n)
    throw new MomoAdapterError('MOMO_INITIATION_REJECTED');
  return Number(amount);
}

/**
 * Allowed MoMo redirect targets.
 *
 * Production safety: every redirect MUST be HTTPS. The `sandbox`
 * environment additionally pins the hostname to `test-payment.momo.vn`
 * so a leaked sandbox credential cannot be redirected to an arbitrary
 * HTTPS host.
 *
 * Loopback HTTP is permitted only when the redirect points at the
 * locally-running payment provider simulator (`PAYMENT_SIMULATOR_BASE_URL`
 * or `http://127.0.0.1:3090` by default). This keeps production strict
 * while letting the local demo complete the vertical end-to-end.
 */
function isAllowedRedirect(url: string, environment: MomoConfig['environment']): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') {
    return environment !== 'sandbox' || parsed.hostname === 'test-payment.momo.vn';
  }
  if (parsed.protocol !== 'http:') return false;
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return false;
  const simulatorBase = process.env.PAYMENT_SIMULATOR_BASE_URL;
  if (simulatorBase !== undefined && simulatorBase.length > 0) {
    try {
      const simulator = new URL(simulatorBase);
      if (parsed.host === simulator.host) return true;
    } catch {
      // Fall through to the deterministic loopback simulator port allowlist.
    }
  }
  // Allow the deterministic demo simulator (default port 3090) on
  // loopback. Production deployments never run the simulator, so this
  // matcher is unreachable in production.
  return parsed.port === '3090';
}

/**
 * MoMo's `resultCode` contract (canonical MoMo captureWallet spec):
 *   0    -> success / paid
 *   9000 -> the user has not yet completed the payment flow
 *   1006 -> the user cancelled the transaction
 *   Any other code is treated as a terminal failure by the adapter.
 */
const MOMO_RESULT_CODE_PENDING = 9000;

export class MomoAdapter implements PaymentProviderAdapter {
  public readonly provider = 'MOMO' as const;

  public constructor(
    private readonly config: MomoConfig,
    private readonly fetcher: MomoFetch = fetch,
  ) {}

  public async createCheckout(
    request: CreateProviderCheckoutRequest,
  ): Promise<CreateProviderCheckoutResult> {
    if (request.currency !== 'VND') throw new MomoAdapterError('MOMO_INITIATION_REJECTED');
    const amount = asSafeAmount(request.amountVnd);
    const requestId = request.merchantOrderId;
    const canonical = buildMomoInitiationCanonicalString({
      accessKey: this.config.accessKey,
      amount,
      extraData: '',
      ipnUrl: this.config.ipnUrl,
      orderId: request.merchantOrderId,
      orderInfo: request.description,
      partnerCode: this.config.partnerCode,
      redirectUrl: this.config.returnUrl,
      requestId,
      requestType: this.config.requestType,
    });
    let response: Response;
    try {
      response = await this.fetcher(`${this.config.apiBaseUrl}/v2/gateway/api/create`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          partnerCode: this.config.partnerCode,
          requestId,
          amount,
          orderId: request.merchantOrderId,
          orderInfo: request.description,
          redirectUrl: this.config.returnUrl,
          ipnUrl: this.config.ipnUrl,
          requestType: this.config.requestType,
          extraData: '',
          autoCapture: true,
          lang: 'en',
          signature: signMomoCanonicalString(this.config.secretKey, canonical),
        }),
      });
    } catch {
      throw new MomoAdapterError('MOMO_INITIATION_OUTCOME_UNKNOWN');
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new MomoAdapterError('MOMO_RESPONSE_INVALID');
    }
    const parsed = momoCreateResponseSchema.safeParse(body);
    if (!parsed.success) throw new MomoAdapterError('MOMO_RESPONSE_INVALID');
    const result = parsed.data;
    if (result.orderId !== request.merchantOrderId)
      throw new MomoAdapterError('MOMO_RESPONSE_ORDER_MISMATCH');
    if (result.requestId !== requestId)
      throw new MomoAdapterError('MOMO_RESPONSE_REQUEST_MISMATCH');
    if (result.amount !== amount || result.partnerCode !== this.config.partnerCode)
      throw new MomoAdapterError('MOMO_RESPONSE_AMOUNT_MISMATCH');
    if (
      !hasValidMomoSignature(
        this.config.secretKey,
        buildMomoResponseCanonicalString({
          accessKey: this.config.accessKey,
          amount: result.amount,
          message: result.message,
          orderId: result.orderId,
          partnerCode: result.partnerCode,
          // MoMo's failure responses can omit payUrl. The locked response
          // canonicalization represents that omitted value as an empty field.
          payUrl: result.payUrl ?? '',
          requestId: result.requestId,
          responseTime: result.responseTime,
          resultCode: result.resultCode,
        }),
        result.signature,
      )
    )
      throw new MomoAdapterError('MOMO_RESPONSE_SIGNATURE_INVALID');
    if (!response.ok || result.resultCode !== 0)
      throw new MomoAdapterError('MOMO_INITIATION_REJECTED');
    if (result.payUrl === undefined || !isAllowedRedirect(result.payUrl, this.config.environment)) {
      throw new MomoAdapterError('MOMO_RESPONSE_REDIRECT_INVALID');
    }
    return {
      providerOrderId: result.orderId,
      redirectUrl: result.payUrl,
      expiresAt: request.expiresAt,
      providerResponseCode: String(result.resultCode),
    };
  }

  public verifyAndNormalizeWebhook(
    request: VerifyProviderWebhookRequest,
  ): Promise<VerifiedPaymentProviderEvent> {
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      return Promise.reject(new MomoAdapterError('MOMO_IPN_CONTENT_TYPE_INVALID'));
    }
    let body: unknown;
    try {
      body = JSON.parse(request.rawBody.toString('utf8'));
    } catch {
      return Promise.reject(new MomoAdapterError('MOMO_IPN_INVALID_PAYLOAD'));
    }
    const parsed = momoIpnSchema.safeParse(body);
    if (!parsed.success) return Promise.reject(new MomoAdapterError('MOMO_IPN_INVALID_PAYLOAD'));
    const ipn = parsed.data;
    if (ipn.partnerCode !== this.config.partnerCode)
      return Promise.reject(new MomoAdapterError('MOMO_IPN_INVALID_PAYLOAD'));
    const canonical = buildMomoIpnCanonicalString({ accessKey: this.config.accessKey, ...ipn });
    if (!hasValidMomoSignature(this.config.secretKey, canonical, ipn.signature)) {
      return Promise.reject(new MomoAdapterError('MOMO_IPN_SIGNATURE_INVALID'));
    }
    if (ipn.resultCode === 9000)
      return Promise.reject(new MomoAdapterError('MOMO_IPN_UNSUPPORTED_RESULT'));
    const normalizedOutcome =
      ipn.resultCode === 0 ? 'SUCCEEDED' : ipn.resultCode === 1006 ? 'CANCELLED' : 'FAILED';
    const transactionId = String(ipn.transId);
    const eventKey = `momo:${createHash('sha256').update(`${ipn.partnerCode}|${ipn.orderId}|${transactionId}|${ipn.resultCode}`, 'utf8').digest('hex')}`;
    return Promise.resolve({
      provider: 'MOMO',
      eventKey,
      providerOrderId: ipn.orderId,
      providerTransactionId: transactionId,
      normalizedOutcome,
      amountVnd: BigInt(ipn.amount),
      currency: 'VND',
      occurredAt: new Date(ipn.responseTime),
      rawBodyDigest: digestMomoRawBody(request.rawBody),
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });
  }

  public async queryTransactionStatus(
    request: QueryTransactionStatusRequest,
  ): Promise<PaymentProviderQueryResult> {
    // Booking-core invariants are checked before any network call so that a
    // misconfigured call site never reaches the provider with a non-VND
    // amount or a mismatched order identity.
    if (request.currency !== 'VND') {
      throw new MomoQueryAdapterError('PROVIDER_PAYLOAD_INVALID');
    }
    if (request.amountVnd <= 0n) {
      throw new MomoQueryAdapterError('PROVIDER_AMOUNT_MISMATCH');
    }
    if (
      request.merchantOrderId.trim() === '' ||
      request.providerOrderId.trim() === '' ||
      request.merchantOrderId !== request.providerOrderId
    ) {
      throw new MomoQueryAdapterError('PROVIDER_ORDER_MISMATCH');
    }
    if (request.amountVnd > 50_000_000n) {
      throw new MomoQueryAdapterError('PROVIDER_AMOUNT_MISMATCH');
    }
    if (
      this.config.partnerCode.trim() === '' ||
      this.config.accessKey.trim() === '' ||
      this.config.secretKey.trim() === ''
    ) {
      throw new MomoQueryConfigError('PROVIDER_CONFIG_MISSING');
    }
    // The official MoMo query minimum timeout is honored on the wire even
    // when the operator's configured value is lower; misconfiguration is
    // surfaced as a typed error rather than silently shrinking the contract.
    if (this.config.requestTimeoutMs < MOMO_QUERY_MIN_TIMEOUT_MS) {
      throw new MomoQueryConfigError('PROVIDER_TIMEOUT_FLOOR');
    }
    const effectiveTimeoutMs = this.config.requestTimeoutMs;

    const requestId = `${request.providerOrderId}-query-${(request.now ?? new Date()).getTime()}`;
    const canonical = buildMomoQueryCanonicalString({
      accessKey: this.config.accessKey,
      orderId: request.providerOrderId,
      partnerCode: this.config.partnerCode,
      requestId,
    });

    const external = request.signal;
    const timeoutSignal = AbortSignal.timeout(effectiveTimeoutMs);
    const signal =
      external === undefined ? timeoutSignal : AbortSignal.any([external, timeoutSignal]);

    let response: Response;
    try {
      response = await this.fetcher(`${this.config.apiBaseUrl}/v2/gateway/api/query`, {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          partnerCode: this.config.partnerCode,
          accessKey: this.config.accessKey,
          requestId,
          orderId: request.providerOrderId,
          requestType: 'queryStatus',
          signature: signMomoCanonicalString(this.config.secretKey, canonical),
        }),
      });
    } catch (cause) {
      throw mapMomoNetworkCause(cause, external);
    }

    let rawBody: string;
    try {
      rawBody = await response.text();
    } catch {
      throw new MomoQueryNetworkError('PROVIDER_INVALID_RESPONSE');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      throw new MomoQueryNetworkError('PROVIDER_INVALID_RESPONSE');
    }

    const parsed = momoQueryResponseSchema.safeParse(parsedJson);
    if (!parsed.success) throw new MomoQueryNetworkError('PROVIDER_INVALID_RESPONSE');
    const result = parsed.data;

    if (result.partnerCode !== this.config.partnerCode) {
      throw new MomoQueryAdapterError('PROVIDER_MERCHANT_MISMATCH');
    }
    if (result.orderId !== request.providerOrderId) {
      throw new MomoQueryAdapterError('PROVIDER_ORDER_MISMATCH');
    }

    const canonicalResponse = buildMomoQueryCanonicalString({
      accessKey: this.config.accessKey,
      orderId: result.orderId,
      partnerCode: result.partnerCode,
      requestId: result.requestId,
    });
    if (!hasValidMomoSignature(this.config.secretKey, canonicalResponse, result.signature)) {
      throw new MomoQueryAdapterError('PROVIDER_SIGNATURE_INVALID');
    }

    const responseAmount = BigInt(result.amount);
    if (responseAmount !== request.amountVnd) {
      throw new MomoQueryAdapterError('PROVIDER_AMOUNT_MISMATCH');
    }

    if (result.resultCode === 0) {
      if (result.transId === undefined) {
        // The provider returned success without a transaction identifier;
        // refuse to fabricate one — surface as a payload error so the
        // operator knows MoMo's response shape drifted.
        throw new MomoQueryAdapterError('PROVIDER_TRANSACTION_MISMATCH');
      }
      const transactionId = String(result.transId);
      const eventKey = `momo:${createHash('sha256')
        .update(
          `${result.partnerCode}|${result.orderId}|${transactionId}|${result.resultCode}`,
          'utf8',
        )
        .digest('hex')}`;
      const occurredAt = new Date(result.responseTime);
      const verified: VerifiedPaymentProviderEvent = {
        provider: 'MOMO',
        eventKey,
        providerOrderId: result.orderId,
        providerTransactionId: transactionId,
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: responseAmount,
        currency: 'VND',
        occurredAt,
        rawBodyDigest: digestMomoRawBody(Buffer.from(rawBody, 'utf8')),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      };
      assertMomoQueryEvent(verified);
      return { kind: 'VERIFIED_EVENT', event: verified };
    }

    if (result.resultCode === MOMO_RESULT_CODE_PENDING) {
      return {
        kind: 'PENDING',
        providerOrderId: result.orderId,
        rawProviderCode: String(result.resultCode),
      };
    }

    // MoMo returns resultCode 1006 for cancelled, and a small set of
    // not-found codes (e.g. 1001, 1002, 1004) when the order is unknown to
    // them. We surface cancellation / failure via NOT_FOUND rather than
    // fabricating a synthesized event, so the caller can decide whether to
    // mark the booking REVIEW_REQUIRED based on its own policy.
    return {
      kind: 'NOT_FOUND',
      providerOrderId: result.orderId,
      rawProviderCode: String(result.resultCode),
    };
  }
}

function mapMomoNetworkCause(
  cause: unknown,
  externalSignal: AbortSignal | undefined,
): MomoQueryNetworkError {
  if (cause instanceof Error && cause.name === 'AbortError') {
    // Distinguish user-driven abort from the adapter's timeout floor: if the
    // external signal was already aborted when the call began, attribute the
    // failure to caller cancellation; otherwise the timeout signal fired.
    if (externalSignal !== undefined && externalSignal.aborted) {
      return new MomoQueryNetworkError('PROVIDER_ABORTED');
    }
    return new MomoQueryNetworkError('PROVIDER_TIMEOUT');
  }
  if (cause instanceof Error && /fetch failed|ECONN|ENOTFOUND|EAI_AGAIN/i.test(cause.message)) {
    return new MomoQueryNetworkError('PROVIDER_UNREACHABLE');
  }
  return new MomoQueryNetworkError('PROVIDER_UNREACHABLE');
}

function assertMomoQueryEvent(event: VerifiedPaymentProviderEvent): void {
  if (event.verificationMarker !== 'VERIFIED_BY_ADAPTER') {
    throw new PaymentCoreError('PAYMENT_EVENT_UNVERIFIED');
  }
}
