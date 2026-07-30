import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { QueryTransactionStatusRequest } from '@room/booking';

import { VnpayAdapter } from '../../src/payment/providers/vnpay/vnpay.adapter.js';
import {
  VnpayQueryAdapterError,
  VnpayQueryConfigError,
  VnpayQueryNetworkError,
} from '../../src/payment/providers/vnpay/vnpay.errors.js';
import {
  buildVnpayCanonicalQuery,
  signVnpayCanonicalQuery,
} from '../../src/payment/providers/vnpay/vnpay.signature.js';

const secret = 'vnpay-test-hash-secret-at-least-thirty-two-characters';
const config = {
  environment: 'sandbox' as const,
  tmnCode: 'VNPAYTST',
  hashSecret: secret,
  apiBaseUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'https://merchant.example.test/api/v1/payments/providers/vnpay/return',
  ipnUrl: 'https://merchant.example.test/api/v1/webhooks/vnpay',
  requestTimeoutMs: 30_000,
};

const baseRequest: QueryTransactionStatusRequest = {
  merchantOrderId: 'VNPAY-order-1',
  providerOrderId: 'VNPAY-order-1',
  amountVnd: 359000n,
  currency: 'VND',
  now: new Date('2026-07-26T00:00:00.000Z'),
};

function buildSuccessResponse(options: {
  vnp_ResponseCode?: string;
  vnp_TransactionStatus?: string;
  vnp_TransactionNo?: string;
  vnp_TmnCode?: string;
  vnp_TxnRef?: string;
  vnp_Amount?: string;
  duplicateAmount?: boolean;
}): string {
  const fields: Record<string, string> = {
    vnp_ResponseCode: options.vnp_ResponseCode ?? '00',
    vnp_TmnCode: options.vnp_TmnCode ?? config.tmnCode,
    vnp_TxnRef: options.vnp_TxnRef ?? baseRequest.providerOrderId,
    vnp_Amount: options.vnp_Amount ?? (359000n * 100n).toString(),
    vnp_TransactionStatus: options.vnp_TransactionStatus ?? '00',
    vnp_TransactionNo: options.vnp_TransactionNo ?? '123456789',
    vnp_Message: 'Success',
  };
  const canonical = buildVnpayCanonicalQuery(fields);
  const signature = signVnpayCanonicalQuery(secret, canonical);
  let body = `${canonical}&vnp_SecureHash=${signature}`;
  if (options.duplicateAmount === true) {
    // Deliberately inject a second vnp_Amount so the parser must reject it.
    body += '&vnp_Amount=1';
  }
  return body;
}

describe('VNPAY QueryDr adapter (Gate B)', () => {
  it('POSTs a form-urlencoded QueryDr body sorted by key with HMAC-SHA512 signature', async () => {
    const fetcher = vi.fn(
      async (_input: string, _init: RequestInit) =>
        new Response(buildSuccessResponse({}), {
          status: 200,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
    );
    const adapter = new VnpayAdapter(config, fetcher);

    const result = await adapter.queryTransactionStatus(baseRequest);

    expect(result.kind).toBe('VERIFIED_EVENT');
    if (result.kind !== 'VERIFIED_EVENT') throw new Error('expected VERIFIED_EVENT');

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html/merchant_webapi/api/transaction',
    );
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded');
    const params = new URLSearchParams(String(init?.body));
    expect(params.get('vnp_TmnCode')).toBe(config.tmnCode);
    expect(params.get('vnp_Command')).toBe('querydr');
    expect(params.get('vnp_Version')).toBe('2.1.0');
    expect(params.get('vnp_TxnRef')).toBe(baseRequest.providerOrderId);
    // QueryDr has no vnp_Amount input.
    expect(params.get('vnp_Amount')).toBeNull();
    // The signed payload (every key except vnp_SecureHash) MUST be in
    // alphabetical order so the provider's verifier reproduces the same
    // canonical string we signed.
    const signedKeys = [...params.keys()].filter((key) => key !== 'vnp_SecureHash');
    const sortedSignedKeys = [...signedKeys].sort((a, b) => a.localeCompare(b));
    expect(signedKeys).toEqual(sortedSignedKeys);
    const bodyWithoutHash = new URLSearchParams(String(init?.body));
    bodyWithoutHash.delete('vnp_SecureHash');
    const expectedCanonical = buildVnpayCanonicalQuery(
      Object.fromEntries(bodyWithoutHash.entries()),
    );
    expect(params.get('vnp_SecureHash')).toBe(
      signVnpayCanonicalQuery(secret, expectedCanonical),
    );

    expect(result.event).toMatchObject({
      provider: 'VNPAY',
      providerOrderId: baseRequest.providerOrderId,
      providerTransactionId: '123456789',
      normalizedOutcome: 'SUCCEEDED',
      amountVnd: 359000n,
      currency: 'VND',
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });
  });

  it('rejects a duplicate-key response before signature verification', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(buildSuccessResponse({ duplicateAmount: true }), {
          status: 200,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
    );
    const adapter = new VnpayAdapter(config, fetcher);

    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_PAYLOAD_INVALID',
    });
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toBeInstanceOf(
      VnpayQueryAdapterError,
    );
  });

  it('rejects a tampered signature with a constant-time HMAC-SHA512 verifier', async () => {
    const fetcher = vi.fn(async () => {
      const canonical = buildVnpayCanonicalQuery({
        vnp_ResponseCode: '00',
        vnp_TmnCode: config.tmnCode,
        vnp_TxnRef: baseRequest.providerOrderId,
        vnp_Amount: (359000n * 100n).toString(),
        vnp_TransactionStatus: '00',
        vnp_TransactionNo: '123456789',
        vnp_Message: 'Success',
      });
      const expected = signVnpayCanonicalQuery(secret, canonical);
      const tampered = `${expected.slice(0, -2)}00`;
      return new Response(`${canonical}&vnp_SecureHash=${tampered}`, { status: 200 });
    });
    const adapter = new VnpayAdapter(config, fetcher);

    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_SIGNATURE_INVALID',
    });
  });

  it.each([
    ['wrong-merchant', 'WRONG_TMN'],
    ['wrong-order', 'OTHER-ORDER'],
    ['wrong-amount', '100'],
  ])('rejects a %s response', async (caseId, value) => {
    const adapter = new VnpayAdapter(
      config,
      vi.fn(async () =>
        new Response(
          buildSuccessResponse(
            caseId === 'wrong-merchant'
              ? { vnp_TmnCode: value }
              : caseId === 'wrong-order'
                ? { vnp_TxnRef: value }
                : { vnp_Amount: value },
          ),
          { status: 200 },
        ),
      ),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toBeInstanceOf(
      VnpayQueryAdapterError,
    );
  });

  it('returns a NOT_FOUND variant when vnp_ResponseCode is 01/02/04', async () => {
    const adapter = new VnpayAdapter(
      config,
      vi.fn(async () => new Response(buildSuccessResponse({ vnp_ResponseCode: '02' }), { status: 200 })),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).resolves.toEqual({
      kind: 'NOT_FOUND',
      providerOrderId: baseRequest.providerOrderId,
      rawProviderCode: '02',
    });
  });

  it('returns a NOT_FOUND variant when responseCode=00 but transactionStatus != 00', async () => {
    const adapter = new VnpayAdapter(
      config,
      vi.fn(async () => new Response(buildSuccessResponse({ vnp_TransactionStatus: '02' }), { status: 200 })),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).resolves.toEqual({
      kind: 'NOT_FOUND',
      providerOrderId: baseRequest.providerOrderId,
      rawProviderCode: '00/02',
    });
  });

  it('returns a PENDING variant for an unknown responseCode that is not 00/01/02/04', async () => {
    const adapter = new VnpayAdapter(
      config,
      vi.fn(async () => new Response(buildSuccessResponse({ vnp_ResponseCode: '99' }), { status: 200 })),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).resolves.toEqual({
      kind: 'PENDING',
      providerOrderId: baseRequest.providerOrderId,
      rawProviderCode: '99',
    });
  });

  it('rejects mismatched merchantOrderId / amount / currency before contacting VNPAY', async () => {
    const fetcher = vi.fn();
    const adapter = new VnpayAdapter(config, fetcher);

    await expect(
      adapter.queryTransactionStatus({ ...baseRequest, currency: 'USD' as 'VND' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_PAYLOAD_INVALID' });
    await expect(
      adapter.queryTransactionStatus({ ...baseRequest, amountVnd: 0n }),
    ).rejects.toMatchObject({ code: 'PROVIDER_AMOUNT_MISMATCH' });
    await expect(
      adapter.queryTransactionStatus({
        ...baseRequest,
        merchantOrderId: 'WRONG-ORDER',
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_ORDER_MISMATCH' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('enforces the documented minimum 30-second timeout floor', async () => {
    const adapter = new VnpayAdapter({ ...config, requestTimeoutMs: 1_000 }, vi.fn());
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toBeInstanceOf(
      VnpayQueryConfigError,
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT_FLOOR',
    });
  });

  it('maps a fetch-level timeout to PROVIDER_TIMEOUT', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const adapter = new VnpayAdapter(
      config,
      vi.fn(async () => {
        throw abort;
      }),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
    });
  });

  it('maps a network failure to PROVIDER_UNREACHABLE', async () => {
    const adapter = new VnpayAdapter(
      config,
      vi.fn(async () => {
        throw new Error('fetch failed ECONNREFUSED');
      }),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toBeInstanceOf(
      VnpayQueryNetworkError,
    );
  });

  it('rejects a successful response missing the transaction number', async () => {
    const adapter = new VnpayAdapter(
      config,
      vi.fn(async () => {
        const fields: Record<string, string> = {
          vnp_ResponseCode: '00',
          vnp_TmnCode: config.tmnCode,
          vnp_TxnRef: baseRequest.providerOrderId,
          vnp_Amount: (359000n * 100n).toString(),
          vnp_TransactionStatus: '00',
          vnp_Message: 'Success',
        };
        const canonical = buildVnpayCanonicalQuery(fields);
        const signature = signVnpayCanonicalQuery(secret, canonical);
        return new Response(`${canonical}&vnp_SecureHash=${signature}`, { status: 200 });
      }),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_TRANSACTION_MISMATCH',
    });
  });

  it('rejects a malformed (non-form-encoded) response with PROVIDER_PAYLOAD_INVALID', async () => {
    const adapter = new VnpayAdapter(
      config,
      vi.fn(async () => new Response('not-a-form-encoded-body', { status: 200 })),
    );
    await expect(adapter.queryTransactionStatus(baseRequest)).rejects.toMatchObject({
      code: 'PROVIDER_PAYLOAD_INVALID',
    });
  });

  it('uses canonical constant-time signature verification', () => {
    const canonical = 'vnp_Amount=100&vnp_ResponseCode=00&vnp_TxnRef=abc';
    const expected = signVnpayCanonicalQuery(secret, canonical);
    const reference = createHmac('sha512', secret).update(canonical, 'utf8').digest('hex');
    expect(expected).toBe(reference);
  });
});
