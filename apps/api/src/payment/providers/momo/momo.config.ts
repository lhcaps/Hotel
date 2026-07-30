import type { ApiEnvironment } from '@room/config';

import { MomoAdapterError } from './momo.errors.js';

export interface MomoConfig {
  readonly environment: 'sandbox' | 'production';
  readonly partnerCode: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly apiBaseUrl: string;
  readonly returnUrl: string;
  readonly ipnUrl: string;
  readonly requestType: 'captureWallet';
  readonly requestTimeoutMs: number;
}

export function loadMomoConfig(environment: ApiEnvironment): MomoConfig | null {
  if (!environment.MOMO_ENABLED) return null;
  const {
    MOMO_PARTNER_CODE: partnerCode,
    MOMO_ACCESS_KEY: accessKey,
    MOMO_SECRET_KEY: secretKey,
    MOMO_API_BASE_URL: apiBaseUrl,
    MOMO_RETURN_URL: returnUrl,
    MOMO_IPN_URL: ipnUrl,
  } = environment;
  if (
    partnerCode === undefined ||
    accessKey === undefined ||
    secretKey === undefined ||
    apiBaseUrl === undefined ||
    returnUrl === undefined ||
    ipnUrl === undefined
  ) {
    throw new MomoAdapterError('MOMO_DISABLED');
  }
  return {
    environment: environment.MOMO_ENVIRONMENT,
    partnerCode,
    accessKey,
    secretKey,
    apiBaseUrl,
    returnUrl,
    ipnUrl,
    requestType: environment.MOMO_REQUEST_TYPE,
    requestTimeoutMs: environment.MOMO_REQUEST_TIMEOUT_MS,
  };
}
