import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export interface MomoInitiationSignatureFields {
  readonly accessKey: string;
  readonly amount: number;
  readonly extraData: string;
  readonly ipnUrl: string;
  readonly orderId: string;
  readonly orderInfo: string;
  readonly partnerCode: string;
  readonly redirectUrl: string;
  readonly requestId: string;
  readonly requestType: 'captureWallet';
}

export interface MomoResponseSignatureFields {
  readonly accessKey: string;
  readonly amount: number;
  readonly message: string;
  readonly orderId: string;
  readonly partnerCode: string;
  readonly payUrl: string;
  readonly requestId: string;
  readonly responseTime: number;
  readonly resultCode: number;
}

export interface MomoIpnSignatureFields {
  readonly accessKey: string;
  readonly amount: number;
  readonly extraData: string;
  readonly message: string;
  readonly orderId: string;
  readonly orderInfo: string;
  readonly orderType: 'momo_wallet';
  readonly partnerCode: string;
  readonly payType: string;
  readonly requestId: string;
  readonly responseTime: number;
  readonly resultCode: number;
  readonly transId: number | string;
}

export interface MomoQuerySignatureFields {
  readonly accessKey: string;
  readonly orderId: string;
  readonly partnerCode: string;
  readonly requestId: string;
}

export function buildMomoInitiationCanonicalString(fields: MomoInitiationSignatureFields): string {
  return `accessKey=${fields.accessKey}&amount=${fields.amount}&extraData=${fields.extraData}&ipnUrl=${fields.ipnUrl}&orderId=${fields.orderId}&orderInfo=${fields.orderInfo}&partnerCode=${fields.partnerCode}&redirectUrl=${fields.redirectUrl}&requestId=${fields.requestId}&requestType=${fields.requestType}`;
}

export function buildMomoResponseCanonicalString(fields: MomoResponseSignatureFields): string {
  return `accessKey=${fields.accessKey}&amount=${fields.amount}&message=${fields.message}&orderId=${fields.orderId}&partnerCode=${fields.partnerCode}&payUrl=${fields.payUrl}&requestId=${fields.requestId}&responseTime=${fields.responseTime}&resultCode=${fields.resultCode}`;
}

export function buildMomoIpnCanonicalString(fields: MomoIpnSignatureFields): string {
  return `accessKey=${fields.accessKey}&amount=${fields.amount}&extraData=${fields.extraData}&message=${fields.message}&orderId=${fields.orderId}&orderInfo=${fields.orderInfo}&orderType=${fields.orderType}&partnerCode=${fields.partnerCode}&payType=${fields.payType}&requestId=${fields.requestId}&responseTime=${fields.responseTime}&resultCode=${fields.resultCode}&transId=${fields.transId}`;
}

/**
 * Official MoMo `queryStatus` request canonical string:
 *   accessKey=...&orderId=...&partnerCode=...&requestId=...
 * Field order is fixed by the provider; do not reorder.
 */
export function buildMomoQueryCanonicalString(fields: MomoQuerySignatureFields): string {
  return `accessKey=${fields.accessKey}&orderId=${fields.orderId}&partnerCode=${fields.partnerCode}&requestId=${fields.requestId}`;
}

export function signMomoCanonicalString(secretKey: string, canonical: string): string {
  return createHmac('sha256', secretKey).update(canonical, 'utf8').digest('hex');
}

export function hasValidMomoSignature(
  secretKey: string,
  canonical: string,
  received: string,
): boolean {
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const expected = Buffer.from(signMomoCanonicalString(secretKey, canonical), 'hex');
  const candidate = Buffer.from(received, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export function digestMomoRawBody(rawBody: Buffer): Buffer {
  return createHash('sha256').update(rawBody).digest();
}
