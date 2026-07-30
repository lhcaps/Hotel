import type { ApiEnvironment } from '@room/config';

import { VnpayAdapterError } from './vnpay.errors.js';

export interface VnpayConfig {
  readonly environment: 'sandbox' | 'production';
  readonly tmnCode: string;
  readonly hashSecret: string;
  readonly apiBaseUrl: string;
  readonly returnUrl: string;
  readonly ipnUrl: string;
  readonly requestTimeoutMs: number;
}

export function loadVnpayConfig(environment: ApiEnvironment): VnpayConfig | null {
  if (!environment.VNPAY_ENABLED) return null;
  const {
    VNPAY_TMN_CODE: tmnCode,
    VNPAY_HASH_SECRET: hashSecret,
    VNPAY_API_BASE_URL: apiBaseUrl,
    VNPAY_RETURN_URL: returnUrl,
    VNPAY_IPN_URL: ipnUrl,
  } = environment;
  if (!tmnCode || !hashSecret || !apiBaseUrl || !returnUrl || !ipnUrl)
    throw new VnpayAdapterError('VNPAY_DISABLED');
  return {
    environment: environment.VNPAY_ENVIRONMENT,
    tmnCode,
    hashSecret,
    apiBaseUrl,
    returnUrl,
    ipnUrl,
    requestTimeoutMs: environment.VNPAY_REQUEST_TIMEOUT_MS,
  };
}
