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

import type { VnpayConfig } from './vnpay.config.js';
import {
  parseVnpayIpnQuery,
  parseVnpayQueryDrResponse,
  type VnpayQueryDrResponse,
} from './vnpay.contracts.js';
import { VnpayAdapterError } from './vnpay.errors.js';
import {
  VnpayQueryAdapterError,
  VnpayQueryConfigError,
  VnpayQueryNetworkError,
} from './vnpay.errors.js';
import {
  buildVnpayCanonicalQuery,
  hasValidVnpaySignature,
  signVnpayCanonicalQuery,
} from './vnpay.signature.js';

type VnpayFetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * VNPAY `QueryDr` minimum timeout floor (per official VNPAY merchant docs).
 * Lower configured values are surfaced as a CONFIG error so operators cannot
 * silently shorten the provider-mandated lower bound.
 */
const VNPAY_QUERY_MIN_TIMEOUT_MS = 30_000;

function vnpayDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

export class VnpayAdapter implements PaymentProviderAdapter {
  public readonly provider = 'VNPAY' as const;
  public constructor(
    private readonly config: VnpayConfig,
    private readonly fetcher: VnpayFetch = fetch,
  ) {}
  public async createCheckout(
    request: CreateProviderCheckoutRequest,
  ): Promise<CreateProviderCheckoutResult> {
    if (request.currency !== 'VND' || request.amountVnd <= 0n)
      throw new VnpayAdapterError('VNPAY_INITIATION_REJECTED');
    const fields: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: (request.amountVnd * 100n).toString(),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: request.merchantOrderId,
      vnp_OrderInfo: request.description,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_CreateDate: vnpayDate(new Date()),
      vnp_ExpireDate: vnpayDate(request.expiresAt),
    };
    const canonical = buildVnpayCanonicalQuery(fields);
    const params = new URLSearchParams(canonical);
    params.set('vnp_SecureHash', signVnpayCanonicalQuery(this.config.hashSecret, canonical));
    return {
      providerOrderId: request.merchantOrderId,
      redirectUrl: `${this.config.apiBaseUrl}?${params.toString()}`,
      expiresAt: request.expiresAt,
      providerResponseCode: 'PENDING',
    };
  }
  public async verifyAndNormalizeWebhook(
    request: VerifyProviderWebhookRequest,
  ): Promise<VerifiedPaymentProviderEvent> {
    const fields = parseVnpayIpnQuery(request.rawBody.toString('utf8'));
    const signature = fields.vnp_SecureHash;
    const canonical = buildVnpayCanonicalQuery(fields);
    if (!hasValidVnpaySignature(this.config.hashSecret, canonical, signature))
      throw new VnpayAdapterError('VNPAY_IPN_SIGNATURE_INVALID');
    const orderId = fields.vnp_TxnRef;
    const transaction = fields.vnp_TransactionNo;
    const amount = fields.vnp_Amount;
    if (
      !orderId ||
      !transaction ||
      !amount ||
      fields.vnp_TmnCode !== this.config.tmnCode ||
      BigInt(amount) % 100n !== 0n
    ) {
      throw new VnpayAdapterError('VNPAY_IPN_INVALID_PAYLOAD');
    }
    const success = fields.vnp_ResponseCode === '00' && fields.vnp_TransactionStatus === '00';
    return {
      provider: 'VNPAY',
      eventKey: `vnpay:${createHash('sha256')
        .update(`${orderId}|${transaction}|${fields.vnp_ResponseCode ?? ''}`, 'utf8')
        .digest('hex')}`,
      providerOrderId: orderId,
      providerTransactionId: transaction,
      normalizedOutcome: success ? 'SUCCEEDED' : 'FAILED',
      amountVnd: BigInt(amount) / 100n,
      currency: 'VND',
      occurredAt: request.receivedAt,
      rawBodyDigest: createHash('sha256').update(request.rawBody).digest(),
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    };
  }
  public async queryTransactionStatus(
    request: QueryTransactionStatusRequest,
  ): Promise<PaymentProviderQueryResult> {
    // Booking-core invariants: refuse to round-trip a non-VND amount or a
    // mismatched order identity. The merchantOrderId we sent at initiation
    // is the only VNPAY-recognized identifier; providerOrderId must equal
    // it because VNPAY has no separate "provider-side order id" concept.
    if (request.currency !== 'VND') {
      throw new VnpayQueryAdapterError('PROVIDER_PAYLOAD_INVALID');
    }
    if (request.amountVnd <= 0n) {
      throw new VnpayQueryAdapterError('PROVIDER_AMOUNT_MISMATCH');
    }
    if (
      request.merchantOrderId.trim() === '' ||
      request.providerOrderId.trim() === '' ||
      request.merchantOrderId !== request.providerOrderId
    ) {
      throw new VnpayQueryAdapterError('PROVIDER_ORDER_MISMATCH');
    }
    if (this.config.tmnCode.trim() === '' || this.config.hashSecret.trim() === '') {
      throw new VnpayQueryConfigError('PROVIDER_CONFIG_MISSING');
    }
    if (this.config.requestTimeoutMs < VNPAY_QUERY_MIN_TIMEOUT_MS) {
      throw new VnpayQueryConfigError('PROVIDER_TIMEOUT_FLOOR');
    }

    // VNPAY's QueryDr canonical-string contract is documented as:
    //   vnp_RequestId, vnp_Version, vnp_Command, vnp_TmnCode, vnp_TxnRef,
    //   vnp_OrderInfo, vnp_TransactionDate, vnp_CreateDate, vnp_IpAddr
    // sorted alphabetically (localeCompare) and URL-encoded without the
    // signature itself.
    const baseDate = request.now ?? new Date();
    const requestId = `${request.providerOrderId}-query-${baseDate.getTime()}`;
    const fields: Record<string, string> = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: this.config.tmnCode,
      vnp_TxnRef: request.providerOrderId,
      vnp_OrderInfo: `Query ${request.providerOrderId}`,
      vnp_TransactionDate: vnpayDate(baseDate),
      vnp_CreateDate: vnpayDate(new Date()),
      vnp_IpAddr: '127.0.0.1',
    };
    const canonical = buildVnpayCanonicalQuery(fields);
    // Body keys are inserted in canonical order so a verifier reading the
    // raw form-encoded stream sees the same sequence our canonical-string
    // builder produced — defense in depth against providers that canonicalize
    // by stream position rather than by re-sorting.
    const bodyParams = new URLSearchParams();
    for (const key of [...Object.keys(fields)].sort((a, b) => a.localeCompare(b))) {
      bodyParams.set(key, fields[key] ?? '');
    }
    bodyParams.set('vnp_SecureHash', signVnpayCanonicalQuery(this.config.hashSecret, canonical));
    const body = bodyParams.toString();

    const external = request.signal;
    const timeoutSignal = AbortSignal.timeout(this.config.requestTimeoutMs);
    const signal =
      external === undefined ? timeoutSignal : AbortSignal.any([external, timeoutSignal]);

    let response: Response;
    try {
      response = await this.fetcher(
        `${this.config.apiBaseUrl.replace(/\/$/, '')}/merchant_webapi/api/transaction`,
        {
          method: 'POST',
          redirect: 'error',
          signal,
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body,
        },
      );
    } catch (cause) {
      throw mapVnpayNetworkCause(cause, external);
    }

    let rawBody: string;
    try {
      rawBody = await response.text();
    } catch {
      throw new VnpayQueryNetworkError('PROVIDER_INVALID_RESPONSE');
    }

    let responseFields: VnpayQueryDrResponse;
    try {
      responseFields = parseVnpayQueryDrResponse(rawBody);
    } catch (error) {
      if (error instanceof VnpayAdapterError) {
        throw new VnpayQueryAdapterError('PROVIDER_PAYLOAD_INVALID');
      }
      throw new VnpayQueryNetworkError('PROVIDER_INVALID_RESPONSE');
    }

    const signature = responseFields.vnp_SecureHash;
    const signed: Record<string, string> = {
      vnp_ResponseCode: responseFields.vnp_ResponseCode,
      vnp_TmnCode: responseFields.vnp_TmnCode,
      vnp_TxnRef: responseFields.vnp_TxnRef,
      vnp_Amount: responseFields.vnp_Amount,
      vnp_Message: responseFields.vnp_Message,
      ...(responseFields.vnp_TransactionNo !== undefined
        ? { vnp_TransactionNo: responseFields.vnp_TransactionNo }
        : {}),
      ...(responseFields.vnp_TransactionStatus !== undefined
        ? { vnp_TransactionStatus: responseFields.vnp_TransactionStatus }
        : {}),
    };
    const canonicalResponse = buildVnpayCanonicalQuery(signed);
    if (!hasValidVnpaySignature(this.config.hashSecret, canonicalResponse, signature)) {
      throw new VnpayQueryAdapterError('PROVIDER_SIGNATURE_INVALID');
    }
    if (responseFields.vnp_TmnCode !== this.config.tmnCode) {
      throw new VnpayQueryAdapterError('PROVIDER_MERCHANT_MISMATCH');
    }
    if (responseFields.vnp_TxnRef !== request.providerOrderId) {
      throw new VnpayQueryAdapterError('PROVIDER_ORDER_MISMATCH');
    }

    const responseAmount = BigInt(responseFields.vnp_Amount);
    // VNPAY amounts are in minor units (×100); align the asserted amount.
    const expectedMinor = request.amountVnd * 100n;
    if (responseAmount !== expectedMinor || responseAmount % 100n !== 0n) {
      throw new VnpayQueryAdapterError('PROVIDER_AMOUNT_MISMATCH');
    }

    // VNPAY's response codes:
    //   vnp_ResponseCode "00" + vnp_TransactionStatus "00" -> success
    //   vnp_ResponseCode "00" + other status                -> terminal failure
    //   vnp_ResponseCode "01" / "02" / "04"                 -> order unknown
    //   anything else                                      -> PENDING (network/queue)
    const responseCode = responseFields.vnp_ResponseCode;
    const transactionStatus = responseFields.vnp_TransactionStatus ?? '';
    if (responseCode === '00') {
      if (transactionStatus === '00') {
        const transactionNo = responseFields.vnp_TransactionNo;
        if (transactionNo === undefined || transactionNo.trim() === '') {
          throw new VnpayQueryAdapterError('PROVIDER_TRANSACTION_MISMATCH');
        }
        const eventKey = `vnpay:${createHash('sha256')
          .update(`${responseFields.vnp_TxnRef}|${transactionNo}|${responseCode}`, 'utf8')
          .digest('hex')}`;
        const verified: VerifiedPaymentProviderEvent = {
          provider: 'VNPAY',
          eventKey,
          providerOrderId: responseFields.vnp_TxnRef,
          providerTransactionId: transactionNo,
          normalizedOutcome: 'SUCCEEDED',
          amountVnd: responseAmount / 100n,
          currency: 'VND',
          occurredAt: new Date(),
          rawBodyDigest: createHash('sha256').update(Buffer.from(rawBody, 'utf8')).digest(),
          verificationMarker: 'VERIFIED_BY_ADAPTER',
        };
        assertVnpayQueryEvent(verified);
        return { kind: 'VERIFIED_EVENT', event: verified };
      }
      // Terminal but unsuccessful — surface as NOT_FOUND so booking core can
      // choose its own REVIEW_REQUIRED policy. VNPAY does not surface a
      // distinct "cancelled" status from QueryDr.
      return {
        kind: 'NOT_FOUND',
        providerOrderId: responseFields.vnp_TxnRef,
        rawProviderCode: `${responseCode}/${transactionStatus}`,
      };
    }

    if (responseCode === '01' || responseCode === '02' || responseCode === '04') {
      return {
        kind: 'NOT_FOUND',
        providerOrderId: responseFields.vnp_TxnRef,
        rawProviderCode: responseCode,
      };
    }

    return {
      kind: 'PENDING',
      providerOrderId: responseFields.vnp_TxnRef,
      rawProviderCode: responseCode,
    };
  }
}

function mapVnpayNetworkCause(
  cause: unknown,
  externalSignal: AbortSignal | undefined,
): VnpayQueryNetworkError {
  if (cause instanceof Error && cause.name === 'AbortError') {
    if (externalSignal !== undefined && externalSignal.aborted) {
      return new VnpayQueryNetworkError('PROVIDER_ABORTED');
    }
    return new VnpayQueryNetworkError('PROVIDER_TIMEOUT');
  }
  if (cause instanceof Error && /fetch failed|ECONN|ENOTFOUND|EAI_AGAIN/i.test(cause.message)) {
    return new VnpayQueryNetworkError('PROVIDER_UNREACHABLE');
  }
  return new VnpayQueryNetworkError('PROVIDER_UNREACHABLE');
}

function assertVnpayQueryEvent(event: VerifiedPaymentProviderEvent): void {
  if (event.verificationMarker !== 'VERIFIED_BY_ADAPTER') {
    throw new PaymentCoreError('PAYMENT_EVENT_UNVERIFIED');
  }
}
