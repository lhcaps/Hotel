import { createHmac } from 'node:crypto';

export type MomoCreate = {
  accessKey: string;
  amount: number;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
};

export type MomoIpn = {
  accessKey: string;
  amount: number;
  extraData: string;
  message: string;
  orderId: string;
  orderInfo: string;
  orderType: string;
  partnerCode: string;
  payType: string;
  requestId: string;
  responseTime: number;
  resultCode: number;
  transId: number | string;
};

const join = (pairs: readonly string[]) => pairs.join('&');

export function oracleMomoCreate(f: MomoCreate): string {
  return join([
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
  ]);
}

export function oracleMomoIpn(f: MomoIpn): string {
  return join([
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
  ]);
}

export function oracleMomoQuery(f: MomoIpn): string {
  return join([
    `accessKey=${f.accessKey}`,
    `orderId=${f.orderId}`,
    `partnerCode=${f.partnerCode}`,
    `requestId=${f.requestId}`,
  ]);
}

export function oracleHmacSha256(secret: string, canonical: string): string {
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}
