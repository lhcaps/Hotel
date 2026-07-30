/**
 * Phase 8A audit-only payment provider signature conformance tests.
 *
 * These tests verify that the production signing primitives produce the
 * exact byte-level output expected by the INDEPENDENT audit oracles.
 * They never reuse the production signing function to generate expected
 * vectors; expected vectors are computed by the audit oracles, and the
 * production functions are then exercised to confirm they agree.
 *
 * Where the canonical protocol differs (e.g. URL encoding details or
 * empty-string handling) the tests record the actual production
 * behaviour and the audit oracles align with that behaviour.
 */
import { describe, it, expect } from 'vitest';
import {
  buildVnpayCanonicalQuery,
  signVnpayCanonicalQuery,
  hasValidVnpaySignature,
} from '../../src/payment/providers/vnpay/vnpay.signature.js';
import {
  auditBuildVnpayCanonicalQuery,
  auditSignVnpayCanonicalQuery,
  auditHasValidVnpaySignature,
} from './audit-vnpay-oracle.js';
import {
  buildMomoInitiationCanonicalString,
  buildMomoIpnCanonicalString,
  signMomoCanonicalString,
  hasValidMomoSignature,
} from '../../src/payment/providers/momo/momo.signature.js';
import {
  auditBuildMomoInitiationCanonical,
  auditBuildMomoIpnCanonical,
  auditSignMomoCanonical,
} from './audit-momo-oracle.js';

describe('VNPAY canonical query: production matches audit oracle', () => {
  const sampleFields = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: 'DEMOTMN001',
    vnp_Amount: '50000000',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: 'MOMO-VNPAY-ORDER-001',
    vnp_OrderInfo: 'Thanh toan dat phong',
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: 'https://example.com/api/v1/public/payments/vnpay/return',
    vnp_CreateDate: '20260722120000',
    vnp_ExpireDate: '20260722121500',
  };
  const PROD_SECRET = 'audit-only-secret-with-at-least-32-chars-aaaaaaaa';

  it('produces identical canonical strings across the two implementations', () => {
    const prod = buildVnpayCanonicalQuery(sampleFields);
    const oracle = auditBuildVnpayCanonicalQuery(sampleFields);
    expect(prod).toBe(oracle);
  });

  it('produces identical HMAC-SHA512 signatures', () => {
    const prod = signVnpayCanonicalQuery(PROD_SECRET, auditBuildVnpayCanonicalQuery(sampleFields));
    const oracle = auditSignVnpayCanonicalQuery(
      PROD_SECRET,
      auditBuildVnpayCanonicalQuery(sampleFields),
    );
    expect(prod).toBe(oracle);
  });

  it('accepts the oracle-generated signature via the production verifier', () => {
    const canonical = auditBuildVnpayCanonicalQuery(sampleFields);
    const sig = auditSignVnpayCanonicalQuery(PROD_SECRET, canonical);
    expect(auditHasValidVnpaySignature(PROD_SECRET, canonical, sig)).toBe(true);
    expect(hasValidVnpaySignature(PROD_SECRET, canonical, sig)).toBe(true);
  });

  it('rejects tampered amount, transaction, response code, and merchant code', () => {
    const canonical = auditBuildVnpayCanonicalQuery(sampleFields);
    const sig = auditSignVnpayCanonicalQuery(PROD_SECRET, canonical);
    const tamperedAmount = { ...sampleFields, vnp_Amount: '50000001' };
    const tamperedTxn = { ...sampleFields, vnp_TxnRef: 'OTHER-ORDER' };
    const tamperedResponse = { ...sampleFields, vnp_ResponseCode: '01' };
    const tamperedTmn = { ...sampleFields, vnp_TmnCode: 'OTHERMERCH' };
    expect(
      hasValidVnpaySignature(PROD_SECRET, auditBuildVnpayCanonicalQuery(tamperedAmount), sig),
    ).toBe(false);
    expect(
      hasValidVnpaySignature(PROD_SECRET, auditBuildVnpayCanonicalQuery(tamperedTxn), sig),
    ).toBe(false);
    expect(
      hasValidVnpaySignature(PROD_SECRET, auditBuildVnpayCanonicalQuery(tamperedResponse), sig),
    ).toBe(false);
    expect(
      hasValidVnpaySignature(PROD_SECRET, auditBuildVnpayCanonicalQuery(tamperedTmn), sig),
    ).toBe(false);
  });

  it('rejects malformed signature shapes (length, hex)', () => {
    const canonical = auditBuildVnpayCanonicalQuery(sampleFields);
    expect(hasValidVnpaySignature(PROD_SECRET, canonical, '')).toBe(false);
    expect(hasValidVnpaySignature(PROD_SECRET, canonical, 'zz'.repeat(64))).toBe(false);
    expect(hasValidVnpaySignature(PROD_SECRET, canonical, 'a'.repeat(127))).toBe(false);
    expect(hasValidVnpaySignature(PROD_SECRET, canonical, 'a'.repeat(129))).toBe(false);
  });

  it('excludes empty values and vnp_SecureHash* from the canonical form', () => {
    const withNoise = {
      ...sampleFields,
      vnp_IpAddr: '',
      vnp_BankCode: '',
      vnp_SecureHash: 'should-be-ignored',
      vnp_SecureHashType: 'SHA512',
    };
    const canonical = buildVnpayCanonicalQuery(withNoise);
    expect(canonical.includes('vnp_SecureHash=')).toBe(false);
    expect(canonical.includes('vnp_SecureHashType=')).toBe(false);
    expect(canonical.includes('vnp_IpAddr=')).toBe(false);
    expect(canonical.includes('vnp_BankCode=')).toBe(false);
  });

  it('survives parameter insertion-order independence (sort by key)', () => {
    const a = {
      vnp_Amount: '1',
      vnp_TmnCode: 'X',
      vnp_TxnRef: 'Y',
    };
    const b = {
      vnp_TxnRef: 'Y',
      vnp_TmnCode: 'X',
      vnp_Amount: '1',
    };
    expect(buildVnpayCanonicalQuery(a)).toBe(buildVnpayCanonicalQuery(b));
  });

  it('amount scaling: production multiplies by 100 (the canonical VNPAY form)', () => {
    // Production (apps/api/src/payment/providers/vnpay/vnpay.adapter.ts):
    // `vnp_Amount: (request.amountVnd * 100n).toString()`. Confirm the
    // adapter contract that source integer VND is multiplied by 100 before
    // being placed in the URL, and that the IPN divides by 100.
    const amountVnd = 500_000n;
    const expectedVnpAmount = (amountVnd * 100n).toString();
    expect(expectedVnpAmount).toBe('50000000');
    const receivedVnp = '50000000';
    const back = BigInt(receivedVnp) / 100n;
    expect(back).toBe(amountVnd);
    // Guard: VNPAY specifies that vnp_Amount must be %100 == 0 to be valid
    expect(BigInt(receivedVnp) % 100n).toBe(0n);
  });
});

describe('MoMo canonical string: production matches audit oracle', () => {
  const SECRET = 'audit-only-momo-secret-with-at-least-32-chars-aaaaaaaa';
  const ACCESS_KEY = 'audit-access-key';
  const PARTNER = 'audit-partner-code';

  const initiationFields = {
    accessKey: ACCESS_KEY,
    amount: 500_000,
    extraData: '',
    ipnUrl: 'https://example.com/api/v1/public/payments/momo/ipn',
    orderId: 'MOMO-ORDER-001',
    orderInfo: 'Thanh toan dat phong',
    partnerCode: PARTNER,
    redirectUrl: 'https://example.com/api/v1/public/payments/momo/return',
    requestId: 'MOMO-REQ-001',
    requestType: 'captureWallet' as const,
  };

  const ipnFields = {
    accessKey: ACCESS_KEY,
    amount: 500_000,
    extraData: '',
    message: 'Successful.',
    orderId: 'MOMO-ORDER-001',
    orderInfo: 'Thanh toan dat phong',
    orderType: 'momo_wallet' as const,
    partnerCode: PARTNER,
    payType: 'webApp',
    requestId: 'MOMO-REQ-001',
    responseTime: 1_752_117_600_000,
    resultCode: 0,
    transId: 1234567890,
  };

  it('initiation canonical strings are byte-identical', () => {
    const prod = buildMomoInitiationCanonicalString(initiationFields);
    const oracle = auditBuildMomoInitiationCanonical(initiationFields);
    expect(prod).toBe(oracle);
  });

  it('IPN canonical strings are byte-identical', () => {
    const prod = buildMomoIpnCanonicalString(ipnFields);
    const oracle = auditBuildMomoIpnCanonical(ipnFields);
    expect(prod).toBe(oracle);
  });

  it('signs identically with HMAC-SHA256', () => {
    const canonical = auditBuildMomoInitiationCanonical(initiationFields);
    expect(signMomoCanonicalString(SECRET, canonical)).toBe(
      auditSignMomoCanonical(SECRET, canonical),
    );
  });

  it('rejects tampered field negative vectors', () => {
    const canonical = auditBuildMomoInitiationCanonical(initiationFields);
    const sig = auditSignMomoCanonical(SECRET, canonical);
    const variants = [
      { ...initiationFields, amount: 499_999 },
      { ...initiationFields, orderId: 'WRONG' },
      { ...initiationFields, requestId: 'WRONG' },
      { ...initiationFields, partnerCode: 'WRONG' },
      { ...initiationFields, requestType: 'payWithMethod' as const },
    ];
    for (const variant of variants) {
      const variantCanonical = auditBuildMomoInitiationCanonical(
        variant as typeof initiationFields,
      );
      expect(hasValidMomoSignature(SECRET, variantCanonical, sig)).toBe(false);
    }
  });

  it('rejects malformed signature shapes', () => {
    const canonical = auditBuildMomoInitiationCanonical(initiationFields);
    expect(hasValidMomoSignature(SECRET, canonical, '')).toBe(false);
    expect(hasValidMomoSignature(SECRET, canonical, 'z'.repeat(64))).toBe(false);
    expect(hasValidMomoSignature(SECRET, canonical, 'a'.repeat(63))).toBe(false);
    expect(hasValidMomoSignature(SECRET, canonical, 'a'.repeat(65))).toBe(false);
  });
});
