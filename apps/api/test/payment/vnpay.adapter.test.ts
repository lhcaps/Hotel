import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  buildVnpayCanonicalQuery,
  hasValidVnpaySignature,
  signVnpayCanonicalQuery,
} from '../../src/payment/providers/vnpay/vnpay.signature.js';
import { VnpayAdapter } from '../../src/payment/providers/vnpay/vnpay.adapter.js';

const secret = 'vnpay-test-hash-secret-at-least-thirty-two-characters';

describe('VNPAY Checkout v2.1.0 signatures', () => {
  it('sorts and URL-encodes the official non-empty request fields before HMAC-SHA512', () => {
    const canonical = buildVnpayCanonicalQuery({
      vnp_TmnCode: 'VNPAYTST',
      vnp_Amount: '35900000',
      vnp_OrderInfo: 'Thanh toan dat phong Ha Noi',
      vnp_Empty: '',
      vnp_CreateDate: '20260726221500',
    });

    expect(canonical).toBe(
      'vnp_Amount=35900000&vnp_CreateDate=20260726221500&vnp_OrderInfo=Thanh+toan+dat+phong+Ha+Noi&vnp_TmnCode=VNPAYTST',
    );
    expect(signVnpayCanonicalQuery(secret, canonical)).toBe(
      createHmac('sha512', secret).update(canonical, 'utf8').digest('hex'),
    );
  });

  it('accepts only a lower-case HMAC-SHA512 signature for the verified IPN fields', () => {
    const canonical = 'vnp_Amount=35900000&vnp_ResponseCode=00&vnp_TxnRef=VNPAY-order-1';
    const signature = signVnpayCanonicalQuery(secret, canonical);

    expect(hasValidVnpaySignature(secret, canonical, signature)).toBe(true);
    expect(hasValidVnpaySignature(secret, canonical, signature.toUpperCase())).toBe(false);
    expect(hasValidVnpaySignature(secret, canonical, 'not-a-hash')).toBe(false);
  });

  it('rejects duplicate IPN keys before the verified event reaches payment core', async () => {
    const adapter = new VnpayAdapter({
      environment: 'sandbox',
      tmnCode: 'VNPAYTST',
      hashSecret: secret,
      apiBaseUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: 'https://merchant.example.test/api/v1/payments/providers/vnpay/return',
      ipnUrl: 'https://merchant.example.test/api/v1/webhooks/vnpay',
      requestTimeoutMs: 10_000,
    });
    const fields = {
      vnp_Amount: '35900000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'VNPAYTST',
      vnp_TransactionNo: '123456789',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: 'VNPAY-order-1',
    };
    const canonical = buildVnpayCanonicalQuery(fields);
    const raw = `${canonical}&vnp_SecureHash=${signVnpayCanonicalQuery(secret, canonical)}&vnp_Amount=1`;

    await expect(
      adapter.verifyAndNormalizeWebhook({
        rawBody: Buffer.from(raw, 'utf8'),
        headers: {},
        receivedAt: new Date('2026-07-26T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'VNPAY_IPN_INVALID_PAYLOAD' });
  });
});
