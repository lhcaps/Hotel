import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { QueryTransactionStatusRequest } from '@room/booking';

import {
  MomoAdapter,
  buildMomoQueryCanonicalString,
} from '../../src/payment/providers/momo/momo.adapter.js';
import {
  MomoQueryAdapterError,
  MomoQueryConfigError,
  MomoQueryNetworkError,
} from '../../src/payment/providers/momo/momo.errors.js';
import type { MomoConfig } from '../../src/payment/providers/momo/momo.adapter.js';

const config: MomoConfig = {
  environment: 'sandbox',
  partnerCode: 'MOMOT5BZ20231213_TEST',
  accessKey: 'test-access-key',
  secretKey: 'test-secret-key-with-at-least-thirty-two-chars',
  apiBaseUrl: 'https://test-payment.momo.vn',
  returnUrl: 'https://merchant.example.test/api/v1/payments/providers/momo/return',
  ipnUrl: 'https://merchant.example.test/api/v1/webhooks/momo',
  requestType: 'captureWallet',
  requestTimeoutMs: 30_000,
};

function sign(canonical: string): string {
  return createHmac('sha256', config.secretKey).update(canonical, 'utf8').digest('hex');
}

const baseRequest: QueryTransactionStatusRequest = {
  merchantOrderId: 'MOMO-7d4d935e-6a14-40e1-a0fb-123456789abc',
  providerOrderId: 'MOMO-7d4d935e-6a14-40e1-a0fb-123456789abc',
  amountVnd: 1000n,
  currency: 'VND',
  now: new Date('2026-07-27T00:00:00.000Z'),
};

describe('MoMo queryStatus adapter (Gate B)', () => {
  it('builds the official accessKey|orderId|partnerCode|requestId canonical string', () => {
    const canonical = buildMomoQueryCanonicalString({
      accessKey: config.accessKey,
      orderId: baseRequest.providerOrderId,
      partnerCode: config.partnerCode,
      requestId: 'test-request-id',
    });
    expect(canonical).toBe(
      `accessKey=${config.accessKey}&orderId=${baseRequest.providerOrderId}&partnerCode=${config.partnerCode}&requestId=test-request-id`,
    );
  });

  it('POSTs to /v2/gateway/api/query with the canonical signature and a >=30s timeout', async () => {
    const requestIdPattern = /-query-\d+$/;
    const fetcher = vi.fn(
      async (_input: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            partnerCode: config.partnerCode,
            orderId: baseRequest.providerOrderId,
            requestId: 'whatever-the-server-returns',
            amount: 1000,
            responseTime: 1721720619912,
            message: 'Successful.',
            resultCode: 0,
            transId: '4088878653',
            signature: sign(
              `accessKey=${config.accessKey}&orderId=${baseRequest.providerOrderId}&partnerCode=${config.partnerCode}&requestId=whatever-the-server-returns`,
            ),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const adapter = new MomoAdapter(config, fetcher);

    const result = await adapter.queryTransactionStatus(baseRequest);
    expect(result.kind).toBe('VERIFIED_EVENT');
    if (result.kind !== 'VERIFIED_EVENT') throw new Error('expected VERIFIED_EVENT');

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://test-payment.momo.vn/v2/gateway/api/query');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.requestType).toBe('queryStatus');
    expect(typeof body.requestId).toBe('string');
    expect(requestIdPattern.test(String(body.requestId))).toBe(true);
    expect(body.partnerCode).toBe(config.partnerCode);
    expect(body.orderId).toBe(baseRequest.providerOrderId);
    // The signature must match the canonical string the adapter itself emits.
    const canonical = buildMomoQueryCanonicalString({
      accessKey: config.accessKey,
      orderId: baseRequest.providerOrderId,
      partnerCode: config.partnerCode,
      requestId: String(body.requestId),
    });
    expect(body.signature).toBe(sign(canonical));

    expect(result.event).toMatchObject({
      provider: 'MOMO',
      providerOrderId: baseRequest.providerOrderId,
      providerTransactionId: '4088878653',
      normalizedOutcome: 'SUCCEEDED',
      amountVnd: 1000n,
      currency: 'VND',
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });
    expect(result.event.rawBodyDigest).toHaveLength(32);
  });

  it('rejects a non-VND amount, mismatched order, or unsafe amount without contacting the provider', async () => {
    const fetcher = vi.fn();
    const adapter = new MomoAdapter(config, fetcher);

    await expect(
      adapter.queryTransactionStatus({ ...baseRequest, currency: 'USD' as 'VND' }),
    ).rejects.toBeInstanceOf(MomoQueryAdapterError);
    await expect(
      adapter.queryTransactionStatus({ ...baseRequest, amountVnd: 0n }),
    ).rejects.toMatchObject({ code: 'PROVIDER_AMOUNT_MISMATCH' });
    await expect(
      adapter.queryTransactionStatus({
        ...baseRequest,
        providerOrderId: 'OTHER-ORDER',
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_ORDER_MISMATCH' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('enforces the documented 30-second timeout floor via a typed config error', async () => {
    const adapter = new MomoAdapter({ ...config, requestTimeoutMs: 5_000 }, vi.fn());
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toBeInstanceOf(
      MomoQueryConfigError,
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT_FLOOR',
    });
  });

  it('maps a missing config field to a typed config error', async () => {
    const adapter = new MomoAdapter(
      { ...config, accessKey: '' },
      vi.fn(async () => new Response('{}')),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toBeInstanceOf(
      MomoQueryConfigError,
    );
  });

  it.each([
    ['wrong-merchant'],
    ['wrong-order'],
    ['wrong-amount'],
    ['bad-signature'],
    ['missing-transId'],
  ] as const)('rejects a %s query response without contacting core', async (caseId) => {
    const adapter = new MomoAdapter(config, vi.fn(async () => buildQueryResponse(caseId)));
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toBeInstanceOf(
      MomoQueryAdapterError,
    );
  });

  it('maps a malformed JSON response to PROVIDER_INVALID_RESPONSE', async () => {
    const adapter = new MomoAdapter(
      config,
      vi.fn(async () => new Response('not-json', { status: 200 })),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_INVALID_RESPONSE',
    });
  });

  it('maps a fetch-level timeout to PROVIDER_TIMEOUT', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const adapter = new MomoAdapter(
      config,
      vi.fn(async () => {
        throw abort;
      }),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
    });
  });

  it('maps a fetch-level network failure to PROVIDER_UNREACHABLE', async () => {
    const adapter = new MomoAdapter(
      config,
      vi.fn(async () => {
        throw new Error('fetch failed ECONNREFUSED');
      }),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toBeInstanceOf(
      MomoQueryNetworkError,
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_UNREACHABLE',
    });
  });

  it('returns a PENDING variant when the provider reports resultCode 9000', async () => {
    const adapter = new MomoAdapter(
      config,
      vi.fn(async () => buildQueryResponse('pending-9000')),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).resolves.toEqual({
      kind: 'PENDING',
      providerOrderId: baseRequest.providerOrderId,
      rawProviderCode: '9000',
    });
  });

  it('returns a NOT_FOUND variant when the provider reports a non-success, non-pending code', async () => {
    const adapter = new MomoAdapter(
      config,
      vi.fn(async () => buildQueryResponse('cancelled-1006')),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).resolves.toEqual({
      kind: 'NOT_FOUND',
      providerOrderId: baseRequest.providerOrderId,
      rawProviderCode: '1006',
    });
  });

  it('honors an external AbortSignal by surfacing PROVIDER_ABORTED', async () => {
    const abortingFetcher = vi.fn(
      async (_input: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const adapter = new MomoAdapter(config, abortingFetcher);
    const controller = new AbortController();
    queueMicrotask(() => controller.abort());
    await expect(
      adapter.queryTransactionStatus({ ...baseRequest, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'PROVIDER_ABORTED' });
  });
});

function buildQueryResponse(
  variant: 'success' | 'wrong-merchant' | 'wrong-order' | 'wrong-amount' | 'bad-signature' | 'missing-transId' | 'pending-9000' | 'cancelled-1006',
): Response {
  const orderId =
    variant === 'wrong-order' ? 'OTHER-ORDER' : baseRequest.providerOrderId;
  const partnerCode =
    variant === 'wrong-merchant' ? 'WRONG_PARTNER' : config.partnerCode;
  const amount = variant === 'wrong-amount' ? 999 : 1000;
  const resultCode =
    variant === 'pending-9000' ? 9000 : variant === 'cancelled-1006' ? 1006 : 0;
  const transId = variant === 'missing-transId' ? undefined : '4088878653';
  const canonical = `accessKey=${config.accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=server-request-id`;
  const signature =
    variant === 'bad-signature'
      ? 'a'.repeat(64)
      : sign(canonical);
  return new Response(
    JSON.stringify({
      partnerCode,
      orderId,
      requestId: 'server-request-id',
      amount,
      responseTime: 1721720619912,
      message: 'Successful.',
      resultCode,
      ...(transId !== undefined ? { transId } : {}),
      signature,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}
