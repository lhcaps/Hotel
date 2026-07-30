/**
 * Phase 8A audit-only independent MoMo signature oracle.
 *
 * Re-implements the MoMo "captureWallet" signature protocol from first
 * principles using ONLY the canonical-string templates defined in
 * apps/api/src/payment/providers/momo/momo.signature.ts (which themselves
 * restate the published MoMo specification ordering).
 *
 * The audit tests verify that production and oracle agree on the exact
 * byte-level canonical string for fixed deterministic vectors.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export interface AuditMomoInitiationFields {
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

export interface AuditMomoIpnFields {
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

export function auditBuildMomoInitiationCanonical(
  f: AuditMomoInitiationFields,
): string {
  return [
    `accessKey=${f.accessKey}`,
    `amount=${f.amount}`,
    `extraData=${f.extraData}`,
    `ipnUrl=${f.ipnUrl}`,
    `orderId=${f.orderId}`,
    `orderInfo=${f.orderInfo}`,
    `partnerCode=${f.partnerCode}`,
    `redirectUrl=${f.redirectUrl}`,
    `requestId=${f.requestId}`,
    `requestType=${f.requestType}`,
  ].join('&');
}

export function auditBuildMomoIpnCanonical(f: AuditMomoIpnFields): string {
  // Order matches the production function in momo.signature.ts:
  // accessKey, amount, extraData, message, orderId, orderInfo, orderType,
  // partnerCode, payType, requestId, responseTime, resultCode, transId.
  return [
    `accessKey=${f.accessKey}`,
    `amount=${f.amount}`,
    `extraData=${f.extraData}`,
    `message=${f.message}`,
    `orderId=${f.orderId}`,
    `orderInfo=${f.orderInfo}`,
    `orderType=${f.orderType}`,
    `partnerCode=${f.partnerCode}`,
    `payType=${f.payType}`,
    `requestId=${f.requestId}`,
    `responseTime=${f.responseTime}`,
    `resultCode=${f.resultCode}`,
    `transId=${f.transId}`,
  ].join('&');
}

export function auditSignMomoCanonical(secretKey: string, canonical: string): string {
  return createHmac('sha256', secretKey).update(canonical, 'utf8').digest('hex');
}

export function auditHasValidMomoSignature(
  secretKey: string,
  canonical: string,
  received: string,
): boolean {
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const expected = Buffer.from(auditSignMomoCanonical(secretKey, canonical), 'hex');
  const actual = Buffer.from(received, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
