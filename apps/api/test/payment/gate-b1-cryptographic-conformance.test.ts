import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildMomoInitiationCanonicalString,
  buildMomoIpnCanonicalString,
  hasValidMomoSignature,
  signMomoCanonicalString,
} from '../../src/payment/providers/momo/momo.signature.js';
import {
  oracleHmacSha256,
  oracleMomoCreate,
  oracleMomoIpn,
  oracleMomoQuery,
} from './gate-b1-momo.oracle.js';
import {
  buildVnpayCanonicalQuery,
  hasValidVnpaySignature,
  signVnpayCanonicalQuery,
} from '../../src/payment/providers/vnpay/vnpay.signature.js';
import {
  oracleHmacSha512,
  oracleVnpayAmount,
  oracleVnpayCanonical,
  oracleVnpayTimestamp,
} from './gate-b1-vnpay.oracle.js';

const momoSecret = 'gate-b1-momo-secret';
const momoCreate = {
  accessKey: 'AK-01',
  amount: 125000,
  extraData: '',
  ipnUrl: 'https://merchant.test/momo/ipn',
  orderId: 'ORD-01',
  orderInfo: 'Đặt phòng Hà Nội',
  partnerCode: 'PARTNER-01',
  redirectUrl: 'https://merchant.test/momo/return',
  requestId: 'REQ-01',
  requestType: 'captureWallet',
} as const;
const momoIpn = {
  accessKey: 'AK-01',
  amount: 125000,
  extraData: '',
  message: 'Thành công',
  orderId: 'ORD-01',
  orderInfo: 'Đặt phòng Hà Nội',
  orderType: 'momo_wallet',
  partnerCode: 'PARTNER-01',
  payType: 'qr',
  requestId: 'REQ-01',
  responseTime: 1782493200000,
  resultCode: 0,
  transId: 'TX-01',
} as const;
const vnpaySecret = 'gate-b1-vnpay-secret';
const vnpayFields = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: 'TMN01',
  vnp_Amount: '12500000',
  vnp_TxnRef: 'ORD-01',
  vnp_OrderInfo: 'Đặt phòng + tầng 2',
  vnp_ResponseCode: '00',
  vnp_QueryDr: 'Y',
  vnp_Empty: '',
  vnp_SecureHash: 'ignore',
  vnp_SecureHashType: 'SHA512',
};

describe('Gate B1 independent MoMo oracle', () => {
  it('matches create, IPN, and query canonical repository vectors', () => {
    expect(oracleMomoCreate(momoCreate)).toBe(
      'accessKey=AK-01&amount=125000&extraData=&ipnUrl=https://merchant.test/momo/ipn&orderId=ORD-01&orderInfo=Đặt phòng Hà Nội&partnerCode=PARTNER-01&redirectUrl=https://merchant.test/momo/return&requestId=REQ-01&requestType=captureWallet',
    );
    expect(oracleMomoIpn(momoIpn)).toBe(
      'accessKey=AK-01&amount=125000&extraData=&message=Thành công&orderId=ORD-01&orderInfo=Đặt phòng Hà Nội&orderType=momo_wallet&partnerCode=PARTNER-01&payType=qr&requestId=REQ-01&responseTime=1782493200000&resultCode=0&transId=TX-01',
    );
    expect(oracleMomoQuery(momoIpn)).toBe(
      'accessKey=AK-01&orderId=ORD-01&partnerCode=PARTNER-01&requestId=REQ-01',
    );
  });

  it('cross-checks production canonicalization and HMAC-SHA256 without importing it', () => {
    const canonical = oracleMomoCreate(momoCreate);
    expect(buildMomoInitiationCanonicalString(momoCreate)).toBe(canonical);
    expect(oracleHmacSha256(momoSecret, canonical)).toBe(
      '17fbb5d99e558bb2b7604aad4b87e4b097aaf046485558ef51b6526453083e0d',
    );
    expect(signMomoCanonicalString(momoSecret, canonical)).toBe(
      oracleHmacSha256(momoSecret, canonical),
    );
    expect(buildMomoIpnCanonicalString(momoIpn)).toBe(oracleMomoIpn(momoIpn));
  });

  it.each(['amount', 'partnerCode', 'orderId', 'requestId', 'resultCode'] as const)(
    'rejects mutated %s',
    (key) => {
      const canonical = oracleMomoIpn(momoIpn);
      const signature = oracleHmacSha256(momoSecret, canonical);
      const mutation = { ...momoIpn, [key]: key === 'resultCode' ? 1 : `${momoIpn[key]}-changed` };
      expect(hasValidMomoSignature(momoSecret, oracleMomoIpn(mutation), signature)).toBe(false);
    },
  );

  it('rejects reordered, missing, and empty-value canonical mutations', () => {
    const canonical = oracleMomoCreate(momoCreate);
    const signature = oracleHmacSha256(momoSecret, canonical);
    expect(
      hasValidMomoSignature(momoSecret, canonical.split('&').reverse().join('&'), signature),
    ).toBe(false);
    expect(hasValidMomoSignature(momoSecret, canonical.replace('&extraData=', ''), signature)).toBe(
      false,
    );
    expect(
      hasValidMomoSignature(
        momoSecret,
        canonical.replace('orderInfo=Đặt phòng Hà Nội', 'orderInfo='),
        signature,
      ),
    ).toBe(false);
  });
});

describe('Gate B1 independent VNPAY oracle', () => {
  it('uses sorted PAY/QueryDr encoding, VND x100, GMT+7, and HMAC-SHA512', () => {
    const canonical = oracleVnpayCanonical(vnpayFields);
    expect(canonical).toBe(
      'vnp_Amount=12500000&vnp_Command=pay&vnp_OrderInfo=%C4%90%E1%BA%B7t+ph%C3%B2ng+%2B+t%E1%BA%A7ng+2&vnp_QueryDr=Y&vnp_ResponseCode=00&vnp_TmnCode=TMN01&vnp_TxnRef=ORD-01&vnp_Version=2.1.0',
    );
    expect(buildVnpayCanonicalQuery(vnpayFields)).toBe(canonical);
    expect(oracleVnpayAmount(125000n)).toBe('12500000');
    expect(oracleVnpayTimestamp(new Date('2026-07-28T00:00:00.000Z'))).toBe('20260728070000');
    expect(oracleHmacSha512(vnpaySecret, canonical)).toBe(
      'c2d870aef248736c61475e564f49b8e0fe1d5a1751115a849e9a309e477c116d6302866d8b31fa2c3275d553eaa346be7b6c106c55fbe851142a028e4dfbc4b9',
    );
    expect(signVnpayCanonicalQuery(vnpaySecret, canonical)).toBe(
      oracleHmacSha512(vnpaySecret, canonical),
    );
  });

  it('rejects amount, order, response, and merchant mutations', () => {
    const canonical = oracleVnpayCanonical(vnpayFields);
    const signature = oracleHmacSha512(vnpaySecret, canonical);
    for (const key of ['vnp_Amount', 'vnp_TxnRef', 'vnp_ResponseCode', 'vnp_TmnCode']) {
      const mutated = {
        ...vnpayFields,
        [key]: `${vnpayFields[key as keyof typeof vnpayFields]}-changed`,
      };
      expect(hasValidVnpaySignature(vnpaySecret, oracleVnpayCanonical(mutated), signature)).toBe(
        false,
      );
    }
  });

  it('handles duplicate keys, spaces, plus, percent, Vietnamese, and secure-hash exclusion', () => {
    const canonical = oracleVnpayCanonical(vnpayFields);
    expect(canonical).not.toContain('SecureHash');
    expect(canonical).toContain('+');
    expect(canonical).toContain('%2B');
    expect(canonical).toContain('%C4%90');
    expect(oracleVnpayCanonical({ vnp_Amount: '1', vnp_TxnRef: 'x', vnp_Empty: '' })).toBe(
      'vnp_Amount=1&vnp_TxnRef=x',
    );
    expect(oracleVnpayCanonical({ vnp_TxnRef: 'x', vnp_Amount: '1' })).toBe(
      oracleVnpayCanonical({ vnp_Amount: '1', vnp_TxnRef: 'x' }),
    );
    expect(oracleVnpayCanonical({ vnp_TxnRef: 'a b+c%đ' })).toBe('vnp_TxnRef=a+b%2Bc%25%C4%91');
  });

  it('guards production constant-time comparison convention by source', () => {
    const source = readFileSync(
      new URL('../../src/payment/providers/vnpay/vnpay.signature.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('timingSafeEqual');
    expect(source).toContain('actual.length === expected.length');
  });
});
