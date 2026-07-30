import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { describe, expect, it, vi } from 'vitest';

import {
  MomoAdapter,
  buildMomoInitiationCanonicalString,
  buildMomoIpnCanonicalString,
  type MomoConfig,
} from '../../src/payment/providers/momo/momo.adapter.js';
import { MomoAdapterError } from '../../src/payment/providers/momo/momo.errors.js';

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

function createSignedIpn(overrides: Record<string, unknown> = {}): Buffer {
  const event = {
    orderType: 'momo_wallet' as const,
    amount: 1000,
    partnerCode: config.partnerCode,
    orderId: checkout.merchantOrderId,
    extraData: '',
    transId: '4088878653',
    responseTime: 1721720663942,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr' as const,
    requestId: checkout.merchantOrderId,
    orderInfo: checkout.description,
    ...overrides,
  };
  const signature = sign(
    buildMomoIpnCanonicalString({
      accessKey: config.accessKey,
      ...event,
    }),
  );
  return Buffer.from(JSON.stringify({ signature, ...event }), 'utf8');
}

const checkout = {
  merchantOrderId: 'MOMO-7d4d935e-6a14-40e1-a0fb-123456789abc',
  amountVnd: 1000n,
  currency: 'VND' as const,
  returnUrl: config.returnUrl,
  webhookUrl: config.ipnUrl,
  description: 'Room booking MOMO-7d4d935e',
  expiresAt: new Date('2026-07-27T00:00:00.000Z'),
};

describe('MoMo captureWallet adapter', () => {
  it('uses the official initiation canonical field order and HMAC-SHA256', async () => {
    const fetcher = vi.fn(
      async (_input: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            partnerCode: config.partnerCode,
            orderId: checkout.merchantOrderId,
            requestId: checkout.merchantOrderId,
            amount: 1000,
            responseTime: 1721720619912,
            message: 'Successful.',
            resultCode: 0,
            payUrl: 'https://test-payment.momo.vn/v2/gateway/pay?t=opaque',
            signature: sign(
              `accessKey=${config.accessKey}&amount=1000&message=Successful.&orderId=${checkout.merchantOrderId}&partnerCode=${config.partnerCode}&payUrl=https://test-payment.momo.vn/v2/gateway/pay?t=opaque&requestId=${checkout.merchantOrderId}&responseTime=1721720619912&resultCode=0`,
            ),
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
    );
    const adapter = new MomoAdapter(config, fetcher);

    await expect(adapter.createCheckout(checkout)).resolves.toMatchObject({
      providerOrderId: checkout.merchantOrderId,
      redirectUrl: 'https://test-payment.momo.vn/v2/gateway/pay?t=opaque',
    });
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    const canonical = buildMomoInitiationCanonicalString({
      accessKey: config.accessKey,
      amount: 1000,
      extraData: '',
      ipnUrl: config.ipnUrl,
      orderId: checkout.merchantOrderId,
      orderInfo: checkout.description,
      partnerCode: config.partnerCode,
      redirectUrl: config.returnUrl,
      requestId: checkout.merchantOrderId,
      requestType: 'captureWallet',
    });
    expect(canonical).toBe(
      `accessKey=${config.accessKey}&amount=1000&extraData=&ipnUrl=${config.ipnUrl}&orderId=${checkout.merchantOrderId}&orderInfo=${checkout.description}&partnerCode=${config.partnerCode}&redirectUrl=${config.returnUrl}&requestId=${checkout.merchantOrderId}&requestType=captureWallet`,
    );
    expect(request.signature).toBe(sign(canonical));
  });

  it('rejects a response whose provider order, amount, signature, or redirect URL is unsafe', async () => {
    const adapter = new MomoAdapter(
      config,
      async () =>
        new Response(
          JSON.stringify({
            partnerCode: config.partnerCode,
            orderId: 'OTHER-ORDER',
            requestId: checkout.merchantOrderId,
            amount: 1000,
            responseTime: 1721720619912,
            message: 'Successful.',
            resultCode: 0,
            payUrl: 'http://unsafe.example.test/pay',
            signature: 'a'.repeat(64),
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
    );
    await expect(adapter.createCheckout(checkout)).rejects.toMatchObject({
      code: 'MOMO_RESPONSE_ORDER_MISMATCH',
    });
  });

  it('maps an authenticated provider rejection without requiring a checkout URL', async () => {
    const response = {
      partnerCode: config.partnerCode,
      orderId: checkout.merchantOrderId,
      requestId: checkout.merchantOrderId,
      amount: 1000,
      responseTime: 1721720619912,
      message: 'Request rejected.',
      resultCode: 42,
    };
    const adapter = new MomoAdapter(
      config,
      async () =>
        new Response(
          JSON.stringify({
            ...response,
            signature: sign(
              `accessKey=${config.accessKey}&amount=1000&message=Request rejected.&orderId=${checkout.merchantOrderId}&partnerCode=${config.partnerCode}&payUrl=&requestId=${checkout.merchantOrderId}&responseTime=1721720619912&resultCode=42`,
            ),
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );

    await expect(adapter.createCheckout(checkout)).rejects.toMatchObject({
      code: 'MOMO_INITIATION_REJECTED',
    });
  });

  it('verifies a logical-field IPN independently of JSON property order and digests raw bytes', async () => {
    const event = {
      orderType: 'momo_wallet' as const,
      amount: 1000,
      partnerCode: config.partnerCode,
      orderId: checkout.merchantOrderId,
      extraData: '',
      transId: 4088878653,
      responseTime: 1721720663942,
      resultCode: 0,
      message: 'Successful.',
      payType: 'qr' as const,
      requestId: checkout.merchantOrderId,
      orderInfo: checkout.description,
    };
    const signature = sign(buildMomoIpnCanonicalString({ accessKey: config.accessKey, ...event }));
    const raw = Buffer.from(JSON.stringify({ signature, ...event }), 'utf8');
    const adapter = new MomoAdapter(config, vi.fn());

    await expect(
      adapter.verifyAndNormalizeWebhook({
        rawBody: raw,
        headers: { 'content-type': 'application/json' },
        receivedAt: new Date(),
      }),
    ).resolves.toMatchObject({
      provider: 'MOMO',
      providerOrderId: checkout.merchantOrderId,
      providerTransactionId: '4088878653',
      normalizedOutcome: 'SUCCEEDED',
      amountVnd: 1000n,
      currency: 'VND',
      verificationMarker: 'VERIFIED_BY_ADAPTER',
    });
  });

  it.each([
    ['amount', 1001],
    ['orderId', 'MOMO-other-order'],
    ['requestId', 'MOMO-other-request'],
    ['resultCode', 1006],
  ])('rejects an IPN when its signed %s field is changed', async (field, value) => {
    const raw = createSignedIpn();
    const altered = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    altered[field] = value;
    const adapter = new MomoAdapter(config, vi.fn());

    await expect(
      adapter.verifyAndNormalizeWebhook({
        rawBody: Buffer.from(JSON.stringify(altered), 'utf8'),
        headers: { 'content-type': 'application/json; charset=utf-8' },
        receivedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'MOMO_IPN_SIGNATURE_INVALID' });
  });

  it('supports Unicode logical fields and maps cancellation without trusting JSON property order', async () => {
    const raw = createSignedIpn({
      resultCode: 1006,
      message: 'Khách hủy giao dịch',
      orderInfo: 'Đặt phòng Hà Nội',
    });
    const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    const reordered = Buffer.from(
      JSON.stringify({ orderInfo: parsed.orderInfo, signature: parsed.signature, ...parsed }),
      'utf8',
    );
    const adapter = new MomoAdapter(config, vi.fn());

    await expect(
      adapter.verifyAndNormalizeWebhook({
        rawBody: reordered,
        headers: { 'content-type': 'application/json' },
        receivedAt: new Date(),
      }),
    ).resolves.toMatchObject({ normalizedOutcome: 'CANCELLED' });
  });

  it('rejects missing, malformed, and uppercase IPN signatures without disclosing credentials', async () => {
    const adapter = new MomoAdapter(config, vi.fn());
    for (const signature of [undefined, 'not-a-signature', sign('arbitrary').toUpperCase()]) {
      const payload = JSON.parse(createSignedIpn().toString('utf8')) as Record<string, unknown>;
      if (signature === undefined) delete payload.signature;
      else payload.signature = signature;
      await expect(
        adapter.verifyAndNormalizeWebhook({
          rawBody: Buffer.from(JSON.stringify(payload), 'utf8'),
          headers: { 'content-type': 'application/json' },
          receivedAt: new Date(),
        }),
      ).rejects.toBeInstanceOf(MomoAdapterError);
    }
    await expect(
      adapter.verifyAndNormalizeWebhook({
        rawBody: Buffer.from('{', 'utf8'),
        headers: { 'content-type': 'application/json' },
        receivedAt: new Date(),
      }),
    ).rejects.not.toThrow(config.secretKey);
  });

  it('uses a 32-byte SHA-256 body digest that changes with raw bytes', async () => {
    const adapter = new MomoAdapter(config, vi.fn());
    const raw = createSignedIpn();
    const first = await adapter.verifyAndNormalizeWebhook({
      rawBody: raw,
      headers: { 'content-type': 'application/json' },
      receivedAt: new Date(),
    });
    const second = await adapter.verifyAndNormalizeWebhook({
      rawBody: Buffer.concat([raw, Buffer.from(' ', 'utf8')]),
      headers: { 'content-type': 'application/json' },
      receivedAt: new Date(),
    });

    expect(first.rawBodyDigest).toHaveLength(32);
    expect(first.rawBodyDigest.equals(second.rawBodyDigest)).toBe(false);
  });

  it('rejects malformed, missing, or changed IPN signatures before settlement', async () => {
    const adapter = new MomoAdapter(config, vi.fn());
    await expect(
      adapter.verifyAndNormalizeWebhook({
        rawBody: Buffer.from('{'),
        headers: { 'content-type': 'application/json' },
        receivedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'MOMO_IPN_INVALID_PAYLOAD' });
  });
});
