import { describe, expect, it } from 'vitest';

import {
  loopbackOriginAlias,
  parseApiEnvironment,
  parseWebEnvironment,
  parseWorkerEnvironment,
} from '../src/index.js';

const valid = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  API_HOST: '127.0.0.1',
  API_PORT: '3001',
  WEB_ORIGIN: 'http://localhost:3000',
  AUTH_BASE_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://room:room@localhost:5432/room_management',
  REDIS_URL: 'redis://localhost:6379',
  MAIL_HOST: 'localhost',
  MAIL_PORT: '1025',
  MAIL_FROM: 'no-reply@room-management.local',
  BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
  GUEST_OTP_SECRET: 'a'.repeat(48),
  GUEST_CHALLENGE_REF_SECRET: 'b'.repeat(48),
  GUEST_SESSION_SECRET: 'c'.repeat(48),
  BOOKING_IP_DIGEST_SECRET: 'd'.repeat(48),
};

const workerValid = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://room:room@localhost:5432/room_management',
  REDIS_URL: 'redis://localhost:6379',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  SMTP_FROM: 'no-reply@room-management.local',
  GUEST_OTP_SECRET: 'a'.repeat(48),
  GUEST_CHALLENGE_REF_SECRET: 'b'.repeat(48),
  GUEST_SESSION_SECRET: 'c'.repeat(48),
  BOOKING_IP_DIGEST_SECRET: 'd'.repeat(48),
};

const placeholderSecrets = {
  GUEST_OTP_SECRET: 'test-guest-otp-secret-32-chars-min-aaaaaa',
  GUEST_CHALLENGE_REF_SECRET: 'test-challenge-ref-secret-32-chars-aaaa',
  GUEST_SESSION_SECRET: 'test-guest-session-secret-32-chars-aaaa',
  BOOKING_IP_DIGEST_SECRET: 'test-ip-digest-secret-32-chars-aaaaa',
};

describe('loopbackOriginAlias', () => {
  it.each([
    ['http://localhost:3000', 'http://127.0.0.1:3000'],
    ['http://127.0.0.1:3100', 'http://localhost:3100'],
  ])('preserves the configured port for %s', (origin, alias) => {
    expect(loopbackOriginAlias(origin)).toBe(alias);
  });

  it.each(['http://example.test:3000', 'https://localhost:3000', 'https://app.example.test'])(
    'does not widen %s',
    (origin) => {
      expect(loopbackOriginAlias(origin)).toBeUndefined();
    },
  );
});

describe('API environment', () => {
  it('rejects a missing required server variable without exposing a secret', () => {
    const result = parseApiEnvironment({ ...valid, DATABASE_URL: undefined });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('DATABASE_URL');
      expect(result.error.message).not.toContain('room:room');
    }
  });

  it('parses valid local configuration', () => {
    const result = parseApiEnvironment(valid);

    expect(result).toMatchObject({ success: true });
  });

  it('rejects a missing Better Auth secret without exposing it', () => {
    const result = parseApiEnvironment({ ...valid, BETTER_AUTH_SECRET: undefined });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('BETTER_AUTH_SECRET');
      expect(result.error.message).not.toContain(valid.BETTER_AUTH_SECRET);
    }
  });

  it('rejects localhost service URLs in production', () => {
    const result = parseApiEnvironment({ ...valid, NODE_ENV: 'production' });

    expect(result.success).toBe(false);
  });

  it('allows only an explicit production payment-demo boundary', () => {
    const productionDemo = {
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://peacenest.vn',
      AUTH_BASE_URL: 'https://peacenest.vn',
      DATABASE_URL: 'postgresql://room:room@postgres:5432/room_management',
      REDIS_URL: 'redis://redis:6379',
      MOMO_ENABLED: 'true',
      MOMO_ENVIRONMENT: 'production',
      MOMO_PARTNER_CODE: 'PEACENEST_DEMO_MOMO',
      MOMO_ACCESS_KEY: 'peacenest-demo-momo-access',
      MOMO_SECRET_KEY: 'peacenest-demo-momo-secret-key-for-no-money-showcase',
      MOMO_API_BASE_URL: 'https://payments.peacenest.vn',
      MOMO_RETURN_URL: 'https://peacenest.vn/api/v1/payments/providers/momo/return',
      MOMO_IPN_URL: 'https://peacenest.vn/api/v1/webhooks/momo',
      VNPAY_ENABLED: 'true',
      VNPAY_ENVIRONMENT: 'production',
      VNPAY_TMN_CODE: 'PEACENESTDEMO',
      VNPAY_HASH_SECRET: 'peacenest-demo-vnpay-secret-key-for-no-money-showcase',
      VNPAY_API_BASE_URL: 'https://payments.peacenest.vn/vnpay-test/pay',
      VNPAY_RETURN_URL: 'https://peacenest.vn/api/v1/payments/providers/vnpay/return',
      VNPAY_IPN_URL: 'https://peacenest.vn/api/v1/webhooks/vnpay',
      PAYMENT_DEMO_ENABLED: 'true',
      PAYMENT_DEMO_PUBLIC_ORIGIN: 'https://payments.peacenest.vn',
      PAYMENT_DEMO_INTERNAL_BASE_URL: 'http://payment-demo:3090',
      PAYMENT_DEMO_CONTROL_TOKEN: 'peacenest-demo-control-token-at-least-thirty-two-characters',
    };
    expect(parseApiEnvironment(productionDemo)).toMatchObject({ success: true });
    const invalid = parseApiEnvironment({
      ...productionDemo,
      VNPAY_API_BASE_URL: 'https://untrusted.example.test/vnpay-test/pay',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.message).toContain('VNPAY_API_BASE_URL');
  });

  it('rejects placeholder secrets for production API and worker configuration without printing them', () => {
    const api = parseApiEnvironment({
      ...valid,
      ...placeholderSecrets,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
    });
    const worker = parseWorkerEnvironment({
      ...workerValid,
      ...placeholderSecrets,
      NODE_ENV: 'production',
    });

    expect(api.success).toBe(false);
    expect(worker.success).toBe(false);
    if (!worker.success) {
      expect(worker.error.message).toContain('GUEST_OTP_SECRET');
      expect(worker.error.message).not.toContain(placeholderSecrets.GUEST_OTP_SECRET);
    }
  });

  it('requires credentials for a production non-loopback SMTP host', () => {
    const result = parseWorkerEnvironment({
      ...workerValid,
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.example.test',
    });

    expect(result.success).toBe(false);
  });

  it('allows test placeholders for loopback SMTP outside production', () => {
    expect(parseWorkerEnvironment({ ...workerValid, ...placeholderSecrets })).toMatchObject({
      success: true,
    });
  });

  it('allows MoMo to remain disabled with no merchant credentials', () => {
    expect(parseApiEnvironment(valid)).toMatchObject({ success: true });
  });

  it.each(['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY'] as const)(
    'requires %s when MoMo is enabled',
    (missing) => {
      const result = parseApiEnvironment({
        ...valid,
        MOMO_ENABLED: 'true',
        MOMO_ENVIRONMENT: 'sandbox',
        MOMO_PARTNER_CODE: 'MOMOT5BZ20231213_TEST',
        MOMO_ACCESS_KEY: 'test-access-key',
        MOMO_SECRET_KEY: 'test-secret-key-with-at-least-thirty-two-chars',
        MOMO_API_BASE_URL: 'https://test-payment.momo.vn',
        MOMO_RETURN_URL: 'http://127.0.0.1:3100/api/v1/payments/providers/momo/return',
        MOMO_IPN_URL: 'http://127.0.0.1:3101/api/v1/webhooks/momo',
        MOMO_REQUEST_TYPE: 'captureWallet',
        MOMO_REQUEST_TIMEOUT_MS: '30000',
        [missing]: undefined,
      });
      expect(result).toMatchObject({ success: false });
      if (!result.success) {
        expect(result.error.message).toContain(missing);
        expect(result.error.message).not.toContain(
          'test-secret-key-with-at-least-thirty-two-chars',
        );
      }
    },
  );

  it('rejects an invalid MoMo provider URL', () => {
    expect(
      parseApiEnvironment({
        ...valid,
        MOMO_ENABLED: 'true',
        MOMO_ENVIRONMENT: 'sandbox',
        MOMO_PARTNER_CODE: 'PARTNER',
        MOMO_ACCESS_KEY: 'access-key',
        MOMO_SECRET_KEY: 'secret-key-with-at-least-thirty-two-chars',
        MOMO_API_BASE_URL: 'not-a-url',
        MOMO_RETURN_URL: 'http://127.0.0.1:3100/return',
        MOMO_IPN_URL: 'http://127.0.0.1:3101/ipn',
        MOMO_REQUEST_TYPE: 'captureWallet',
        MOMO_REQUEST_TIMEOUT_MS: '30000',
      }),
    ).toMatchObject({ success: false });
  });

  it('rejects sandbox endpoints and HTTP callbacks in production', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
      MOMO_ENABLED: 'true',
      MOMO_ENVIRONMENT: 'production',
      MOMO_PARTNER_CODE: 'PARTNER',
      MOMO_ACCESS_KEY: 'access-key',
      MOMO_SECRET_KEY: 'secret-key-with-at-least-thirty-two-chars',
      MOMO_API_BASE_URL: 'https://test-payment.momo.vn',
      MOMO_RETURN_URL: 'http://example.test/return',
      MOMO_IPN_URL: 'http://example.test/ipn',
      MOMO_REQUEST_TYPE: 'captureWallet',
      MOMO_REQUEST_TIMEOUT_MS: '30000',
    });
    expect(result).toMatchObject({ success: false });
  });

  it('allows the deliberately loopback-only MoMo test adapter configuration', () => {
    expect(
      parseApiEnvironment({
        ...valid,
        MOMO_ENABLED: 'true',
        MOMO_ENVIRONMENT: 'sandbox',
        MOMO_PARTNER_CODE: 'PARTNER',
        MOMO_ACCESS_KEY: 'access-key',
        MOMO_SECRET_KEY: 'secret-key-with-at-least-thirty-two-chars',
        MOMO_API_BASE_URL: 'http://127.0.0.1:43123',
        MOMO_RETURN_URL: 'http://127.0.0.1:3100/return',
        MOMO_IPN_URL: 'http://127.0.0.1:3101/ipn',
        MOMO_REQUEST_TYPE: 'captureWallet',
        MOMO_REQUEST_TIMEOUT_MS: '30000',
      }),
    ).toMatchObject({ success: true });
  });

  it.each([
    'VNPAY_TMN_CODE',
    'VNPAY_HASH_SECRET',
    'VNPAY_API_BASE_URL',
    'VNPAY_RETURN_URL',
    'VNPAY_IPN_URL',
  ] as const)('requires %s when VNPAY is enabled without exposing a hash secret', (missing) => {
    const result = parseApiEnvironment({
      ...valid,
      VNPAY_ENABLED: 'true',
      VNPAY_ENVIRONMENT: 'sandbox',
      VNPAY_TMN_CODE: 'VNPAYTST',
      VNPAY_HASH_SECRET: 'vnpay-test-hash-secret-at-least-thirty-two-characters',
      VNPAY_API_BASE_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      VNPAY_RETURN_URL: 'https://merchant.example.test/api/v1/payments/providers/vnpay/return',
      VNPAY_IPN_URL: 'https://merchant.example.test/api/v1/webhooks/vnpay',
      VNPAY_REQUEST_TIMEOUT_MS: '10000',
      [missing]: undefined,
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain(missing);
      expect(result.error.message).not.toContain(
        'vnpay-test-hash-secret-at-least-thirty-two-characters',
      );
    }
  });

  it('allows the deliberately loopback-only VNPAY test adapter configuration', () => {
    expect(
      parseApiEnvironment({
        ...valid,
        VNPAY_ENABLED: 'true',
        VNPAY_ENVIRONMENT: 'sandbox',
        VNPAY_TMN_CODE: 'VNPAYTST',
        VNPAY_HASH_SECRET: 'vnpay-test-hash-secret-at-least-thirty-two-characters',
        VNPAY_API_BASE_URL: 'http://127.0.0.1:43124/paymentv2/vpcpay.html',
        VNPAY_RETURN_URL: 'http://127.0.0.1:3100/return',
        VNPAY_IPN_URL: 'http://127.0.0.1:3101/ipn',
        VNPAY_REQUEST_TIMEOUT_MS: '10000',
      }),
    ).toMatchObject({ success: true });
  });

  it('rejects a VNPAY sandbox endpoint and placeholder hash secret in production', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
      VNPAY_ENABLED: 'true',
      VNPAY_ENVIRONMENT: 'production',
      VNPAY_TMN_CODE: 'VNPAYTST',
      VNPAY_HASH_SECRET: 'test-vnpay-hash-secret-at-least-thirty-two-characters',
      VNPAY_API_BASE_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      VNPAY_RETURN_URL: 'http://merchant.example.test/return',
      VNPAY_IPN_URL: 'http://merchant.example.test/ipn',
      VNPAY_REQUEST_TIMEOUT_MS: '10000',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('VNPAY_API_BASE_URL');
      expect(result.error.message).not.toContain(
        'test-vnpay-hash-secret-at-least-thirty-two-characters',
      );
    }
  });

  it('allows the simulator-backed MoMo configuration in development', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'development',
      MOMO_ENABLED: 'true',
      MOMO_ENVIRONMENT: 'sandbox',
      MOMO_PARTNER_CODE: 'PARTNER',
      MOMO_ACCESS_KEY: 'access-key',
      MOMO_SECRET_KEY: 'secret-key-with-at-least-thirty-two-chars',
      MOMO_API_BASE_URL: 'http://127.0.0.1:3090',
      MOMO_RETURN_URL: 'http://127.0.0.1:3101/api/v1/payments/providers/momo/return',
      MOMO_IPN_URL: 'http://127.0.0.1:3101/api/v1/webhooks/momo',
      MOMO_REQUEST_TYPE: 'captureWallet',
      MOMO_REQUEST_TIMEOUT_MS: '30000',
      PAYMENT_SIMULATOR_BASE_URL: 'http://127.0.0.1:3090',
    });
    expect(result).toMatchObject({ success: true });
  });

  it('allows the simulator-backed VNPAY configuration in development', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'development',
      VNPAY_ENABLED: 'true',
      VNPAY_ENVIRONMENT: 'sandbox',
      VNPAY_TMN_CODE: 'VNPAYTST',
      VNPAY_HASH_SECRET: 'vnpay-hash-secret-with-at-least-thirty-two-characters',
      VNPAY_API_BASE_URL: 'http://127.0.0.1:3090/vnpay-test/pay',
      VNPAY_RETURN_URL: 'http://127.0.0.1:3101/api/v1/payments/providers/vnpay/return',
      VNPAY_IPN_URL: 'http://127.0.0.1:3101/api/v1/webhooks/vnpay',
      VNPAY_REQUEST_TIMEOUT_MS: '10000',
      PAYMENT_SIMULATOR_BASE_URL: 'http://127.0.0.1:3090',
    });
    expect(result).toMatchObject({ success: true });
  });

  it('rejects a non-loopback MoMo API URL under the simulator branch', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'development',
      MOMO_ENABLED: 'true',
      MOMO_ENVIRONMENT: 'sandbox',
      MOMO_PARTNER_CODE: 'PARTNER',
      MOMO_ACCESS_KEY: 'access-key',
      MOMO_SECRET_KEY: 'secret-key-with-at-least-thirty-two-chars',
      MOMO_API_BASE_URL: 'http://attacker.example.test/momo',
      MOMO_RETURN_URL: 'http://127.0.0.1:3101/api/v1/payments/providers/momo/return',
      MOMO_IPN_URL: 'http://127.0.0.1:3101/api/v1/webhooks/momo',
      MOMO_REQUEST_TYPE: 'captureWallet',
      MOMO_REQUEST_TIMEOUT_MS: '30000',
      PAYMENT_SIMULATOR_BASE_URL: 'http://127.0.0.1:3090',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('MOMO_API_BASE_URL');
    }
  });
});

describe('Google customer auth environment', () => {
  const validGoogle = {
    GOOGLE_AUTH_ENABLED: 'true',
    GOOGLE_CLIENT_ID: '1234567890.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'a-real-google-secret-with-enough-length',
    GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/auth/callback/google',
  };

  it('allows Google customer auth to remain disabled without any credentials', () => {
    expect(parseApiEnvironment({ ...valid })).toMatchObject({ success: true });
  });

  it('requires every Google credential when enabled', () => {
    const partial = { ...valid, GOOGLE_AUTH_ENABLED: 'true' };
    const result = parseApiEnvironment(partial);
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('GOOGLE_CLIENT_ID');
      expect(result.error.message).toContain('GOOGLE_CLIENT_SECRET');
      expect(result.error.message).toContain('GOOGLE_REDIRECT_URI');
    }
  });

  it('accepts a valid test loopback Google configuration', () => {
    expect(parseApiEnvironment({ ...valid, ...validGoogle })).toMatchObject({ success: true });
  });

  it('rejects a non-URL Google redirect URI', () => {
    const result = parseApiEnvironment({
      ...valid,
      ...validGoogle,
      GOOGLE_REDIRECT_URI: 'not-a-url',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('GOOGLE_REDIRECT_URI');
    }
  });

  it('rejects production Google config using HTTP redirect URI', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
      ...validGoogle,
      GOOGLE_REDIRECT_URI: 'http://api.example.test/api/auth/callback/google',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('GOOGLE_REDIRECT_URI');
    }
  });

  it('rejects production Google config using a loopback redirect URI', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
      ...validGoogle,
      GOOGLE_REDIRECT_URI: 'https://localhost/api/auth/callback/google',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('GOOGLE_REDIRECT_URI');
    }
  });

  it('rejects a production Google config whose redirect host does not match WEB_ORIGIN', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
      ...validGoogle,
      GOOGLE_REDIRECT_URI: 'https://api.example.test/api/auth/callback/google',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('GOOGLE_REDIRECT_URI');
    }
  });

  it('rejects placeholder Google client id and secret in production', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
      GOOGLE_AUTH_ENABLED: 'true',
      GOOGLE_CLIENT_ID: 'placeholder-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret-with-enough-length',
      GOOGLE_REDIRECT_URI: 'https://web.example.test/api/auth/callback/google',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('GOOGLE_CLIENT_ID');
      expect(result.error.message).not.toContain('placeholder-client-id');
      expect(result.error.message).not.toContain('test-google-secret-with-enough-length');
    }
  });

  it('accepts a properly-shaped production Google configuration', () => {
    expect(
      parseApiEnvironment({
        ...valid,
        NODE_ENV: 'production',
        WEB_ORIGIN: 'https://web.example.test',
        AUTH_BASE_URL: 'https://api.example.test',
        DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
        REDIS_URL: 'redis://redis.example.test:6379',
        GOOGLE_AUTH_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'real-google-client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'a-real-google-secret-with-enough-length',
        GOOGLE_REDIRECT_URI: 'https://web.example.test/api/auth/callback/google',
      }),
    ).toMatchObject({ success: true });
  });
});

describe('Google dynamic translation environment', () => {
  it('keeps translation disabled by default and does not require a credential', () => {
    const result = parseApiEnvironment({ ...valid });
    expect(result).toMatchObject({ success: true });
    if (result.success) expect(result.data.GOOGLE_TRANSLATION_ENABLED).toBe(false);
  });

  it('requires a server-only key when the optional adapter is enabled', () => {
    const result = parseApiEnvironment({ ...valid, GOOGLE_TRANSLATION_ENABLED: 'true' });
    expect(result).toMatchObject({ success: false });
    if (!result.success) expect(result.error.message).toContain('GOOGLE_TRANSLATION_API_KEY');
  });

  it('parses a bounded timeout without adding a browser environment variable', () => {
    const result = parseApiEnvironment({
      ...valid,
      GOOGLE_TRANSLATION_ENABLED: 'true',
      GOOGLE_TRANSLATION_API_KEY: 'translation-key-that-is-long-enough',
      GOOGLE_TRANSLATION_TIMEOUT_MS: '1500',
    });
    expect(result).toMatchObject({ success: true });
    if (result.success) expect(result.data.GOOGLE_TRANSLATION_TIMEOUT_MS).toBe(1500);
  });
});

describe('Deterministic OAuth harness environment (NODE_ENV=test only)', () => {
  const validTestOAuth = {
    ROOM_TEST_OAUTH_PROVIDER_ID: 'test-google',
    ROOM_TEST_OAUTH_CLIENT_ID: 'test-google-client-id',
    ROOM_TEST_OAUTH_CLIENT_SECRET: 'test-google-client-secret-with-enough-length',
    ROOM_TEST_OAUTH_AUTHORIZATION_URL: 'http://127.0.0.1:3299/oauth2/authorize',
    ROOM_TEST_OAUTH_TOKEN_URL: 'http://127.0.0.1:3299/oauth2/token',
    ROOM_TEST_OAUTH_USERINFO_URL: 'http://127.0.0.1:3299/oauth2/userinfo',
    ROOM_TEST_OAUTH_SCOPES: 'openid,email,profile',
  };

  it('accepts a complete deterministic OAuth test configuration', () => {
    expect(parseApiEnvironment({ ...valid, ...validTestOAuth })).toMatchObject({ success: true });
  });

  it.each([
    'ROOM_TEST_OAUTH_PROVIDER_ID',
    'ROOM_TEST_OAUTH_CLIENT_ID',
    'ROOM_TEST_OAUTH_CLIENT_SECRET',
    'ROOM_TEST_OAUTH_AUTHORIZATION_URL',
    'ROOM_TEST_OAUTH_TOKEN_URL',
    'ROOM_TEST_OAUTH_USERINFO_URL',
  ] as const)('requires %s when any other test OAuth variable is set', (missing) => {
    const partial = { ...validTestOAuth };
    delete (partial as Record<string, unknown>)[missing];
    const result = parseApiEnvironment({ ...valid, ...partial });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain(missing);
    }
  });

  it('rejects deterministic OAuth configuration in production', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
      ...validTestOAuth,
    });
    expect(result).toMatchObject({ success: false });
  });

  it('accepts deterministic OAuth configuration in NODE_ENV=development', () => {
    expect(
      parseApiEnvironment({ ...valid, NODE_ENV: 'development', ...validTestOAuth }),
    ).toMatchObject({ success: true });
  });

  it('rejects a non-URL test OAuth authorization URL', () => {
    const result = parseApiEnvironment({
      ...valid,
      ...validTestOAuth,
      ROOM_TEST_OAUTH_AUTHORIZATION_URL: 'not-a-url',
    });
    expect(result).toMatchObject({ success: false });
  });
});

describe('Browser OAuth test mode switch (server-only)', () => {
  const validTestOAuth = {
    ROOM_TEST_OAUTH_PROVIDER_ID: 'test-google',
    ROOM_TEST_OAUTH_CLIENT_ID: 'test-google-client-id',
    ROOM_TEST_OAUTH_CLIENT_SECRET: 'test-google-client-secret-with-enough-length',
    ROOM_TEST_OAUTH_AUTHORIZATION_URL: 'http://127.0.0.1:3299/oauth2/authorize',
    ROOM_TEST_OAUTH_TOKEN_URL: 'http://127.0.0.1:3299/oauth2/token',
    ROOM_TEST_OAUTH_USERINFO_URL: 'http://127.0.0.1:3299/oauth2/userinfo',
    ROOM_TEST_OAUTH_SCOPES: 'openid,email,profile',
  };

  it('defaults ROOM_TEST_OAUTH_BROWSER_ENABLED to false when absent', () => {
    const result = parseApiEnvironment({ ...valid, ...validTestOAuth });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.ROOM_TEST_OAUTH_BROWSER_ENABLED).toBe(false);
    }
  });

  it('parses ROOM_TEST_OAUTH_BROWSER_ENABLED=true under NODE_ENV=test with loopback OIDC URLs', () => {
    const result = parseApiEnvironment({
      ...valid,
      ...validTestOAuth,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
    });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.ROOM_TEST_OAUTH_BROWSER_ENABLED).toBe(true);
    }
  });

  it('parses ROOM_TEST_OAUTH_BROWSER_ENABLED=true under NODE_ENV=development with loopback OIDC URLs', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'development',
      ...validTestOAuth,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
    });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.ROOM_TEST_OAUTH_BROWSER_ENABLED).toBe(true);
    }
  });

  it('rejects ROOM_TEST_OAUTH_BROWSER_ENABLED=true in production', () => {
    const result = parseApiEnvironment({
      ...valid,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.test',
      AUTH_BASE_URL: 'https://api.example.test',
      DATABASE_URL: 'postgresql://room:room@database.example.test:5432/room_management',
      REDIS_URL: 'redis://redis.example.test:6379',
      ...validTestOAuth,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('ROOM_TEST_OAUTH_BROWSER_ENABLED');
    }
  });

  it('rejects a non-loopback OIDC URL when browser mode is enabled', () => {
    const result = parseApiEnvironment({
      ...valid,
      ...validTestOAuth,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
      ROOM_TEST_OAUTH_AUTHORIZATION_URL: 'https://idp.example.test/oauth2/authorize',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('ROOM_TEST_OAUTH_AUTHORIZATION_URL');
    }
  });

  it('rejects a non-loopback OIDC token URL when browser mode is enabled', () => {
    const result = parseApiEnvironment({
      ...valid,
      ...validTestOAuth,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
      ROOM_TEST_OAUTH_TOKEN_URL: 'https://idp.example.test/oauth2/token',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('ROOM_TEST_OAUTH_TOKEN_URL');
    }
  });

  it('rejects a non-loopback OIDC userinfo URL when browser mode is enabled', () => {
    const result = parseApiEnvironment({
      ...valid,
      ...validTestOAuth,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
      ROOM_TEST_OAUTH_USERINFO_URL: 'https://idp.example.test/oauth2/userinfo',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('ROOM_TEST_OAUTH_USERINFO_URL');
    }
  });

  it('requires OIDC URLs to be set when browser mode is enabled', () => {
    const partial = { ...validTestOAuth };
    delete (partial as Record<string, unknown>).ROOM_TEST_OAUTH_AUTHORIZATION_URL;
    const result = parseApiEnvironment({
      ...valid,
      ...partial,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('ROOM_TEST_OAUTH_BROWSER_ENABLED');
    }
  });
});

describe('Web environment browser OAuth test mode', () => {
  const webValid = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    WEB_PORT: '3100',
    NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3101/api/v1',
    INTERNAL_API_BASE_URL: 'http://127.0.0.1:3101/api/v1',
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'false',
  };

  it('defaults ROOM_TEST_OAUTH_BROWSER_ENABLED to false in the web environment', () => {
    const result = parseWebEnvironment({ ...webValid });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.ROOM_TEST_OAUTH_BROWSER_ENABLED).toBe(false);
    }
  });

  it('requires an explicit server-only API base', () => {
    const result = parseWebEnvironment({ ...webValid, INTERNAL_API_BASE_URL: undefined });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('INTERNAL_API_BASE_URL');
    }
  });

  it('accepts ROOM_TEST_OAUTH_BROWSER_ENABLED=true with a provider id under NODE_ENV=test', () => {
    const result = parseWebEnvironment({
      ...webValid,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
      ROOM_TEST_OAUTH_PROVIDER_ID: 'det-oauth',
    });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.ROOM_TEST_OAUTH_BROWSER_ENABLED).toBe(true);
      expect(result.data.ROOM_TEST_OAUTH_PROVIDER_ID).toBe('det-oauth');
    }
  });

  it('requires ROOM_TEST_OAUTH_PROVIDER_ID when browser mode is enabled', () => {
    const result = parseWebEnvironment({
      ...webValid,
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('ROOM_TEST_OAUTH_PROVIDER_ID');
    }
  });

  it('rejects ROOM_TEST_OAUTH_BROWSER_ENABLED=true in production for the web environment', () => {
    const result = parseWebEnvironment({
      ...webValid,
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test/api/v1',
      ROOM_TEST_OAUTH_BROWSER_ENABLED: 'true',
      ROOM_TEST_OAUTH_PROVIDER_ID: 'det-oauth',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('ROOM_TEST_OAUTH_BROWSER_ENABLED');
    }
  });
});

describe('Payment reconciliation environment (Phase 8B.1 Gate B)', () => {
  it('parses the API environment with default payment reconciliation settings', () => {
    const result = parseApiEnvironment({ ...valid });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.PAYMENT_RECONCILIATION_MAX_ATTEMPTS).toBe(8);
      expect(result.data.PAYMENT_RECONCILIATION_RETRY_DELAYS_MS).toEqual([
        60_000, 300_000, 900_000, 3_600_000, 14_400_000,
      ]);
    }
  });

  it('parses the worker environment with default payment reconciliation settings', () => {
    const result = parseWorkerEnvironment({ ...workerValid });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.PAYMENT_RECONCILIATION_MAX_ATTEMPTS).toBe(8);
      expect(result.data.PAYMENT_RECONCILIATION_RETRY_DELAYS_MS).toEqual([
        60_000, 300_000, 900_000, 3_600_000, 14_400_000,
      ]);
    }
  });

  it('parses the worker environment with default worker-only reconciliation scheduling', () => {
    const result = parseWorkerEnvironment({ ...workerValid });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.WORKER_RECONCILIATION_BATCH_SIZE).toBe(25);
      expect(result.data.WORKER_RECONCILIATION_LEASE_TTL_MS).toBe(120_000);
      expect(result.data.WORKER_RECONCILIATION_INTERVAL_MS).toBe(30_000);
      expect(result.data.WORKER_RECONCILIATION_CONCURRENCY).toBe(5);
    }
  });

  it('accepts an explicit retry schedule within bounds', () => {
    const result = parseApiEnvironment({
      ...valid,
      PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: '1000,5000,60000,3600000',
    });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.PAYMENT_RECONCILIATION_RETRY_DELAYS_MS).toEqual([
        1000, 5000, 60_000, 3_600_000,
      ]);
    }
  });

  it('rejects PAYMENT_RECONCILIATION_MAX_ATTEMPTS below the lower bound', () => {
    const result = parseApiEnvironment({
      ...valid,
      PAYMENT_RECONCILIATION_MAX_ATTEMPTS: '0',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('PAYMENT_RECONCILIATION_MAX_ATTEMPTS');
    }
  });

  it('rejects PAYMENT_RECONCILIATION_MAX_ATTEMPTS above the upper bound', () => {
    const result = parseApiEnvironment({
      ...valid,
      PAYMENT_RECONCILIATION_MAX_ATTEMPTS: '64',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('PAYMENT_RECONCILIATION_MAX_ATTEMPTS');
    }
  });

  it('rejects PAYMENT_RECONCILIATION_RETRY_DELAYS_MS entries below the lower bound', () => {
    const result = parseApiEnvironment({
      ...valid,
      PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: '500,60000',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('PAYMENT_RECONCILIATION_RETRY_DELAYS_MS');
    }
  });

  it('rejects PAYMENT_RECONCILIATION_RETRY_DELAYS_MS entries above the upper bound', () => {
    const result = parseApiEnvironment({
      ...valid,
      PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: '60000,86400001',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('PAYMENT_RECONCILIATION_RETRY_DELAYS_MS');
    }
  });

  it('rejects PAYMENT_RECONCILIATION_RETRY_DELAYS_MS that is not strictly increasing', () => {
    const result = parseApiEnvironment({
      ...valid,
      PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: '60000,300000,300000',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('PAYMENT_RECONCILIATION_RETRY_DELAYS_MS');
    }
  });

  it('rejects PAYMENT_RECONCILIATION_RETRY_DELAYS_MS with non-integer entries', () => {
    const result = parseApiEnvironment({
      ...valid,
      PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: '1000,abc,60000',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('PAYMENT_RECONCILIATION_RETRY_DELAYS_MS');
    }
  });

  it('rejects PAYMENT_RECONCILIATION_RETRY_DELAYS_MS with more entries than the MAX_ATTEMPTS ceiling', () => {
    const result = parseApiEnvironment({
      ...valid,
      PAYMENT_RECONCILIATION_MAX_ATTEMPTS: '3',
      PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: '1000,5000,60000,3600000',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('PAYMENT_RECONCILIATION_RETRY_DELAYS_MS');
    }
  });

  it('accepts the worker-only reconciliation scheduling overrides', () => {
    const result = parseWorkerEnvironment({
      ...workerValid,
      WORKER_RECONCILIATION_BATCH_SIZE: '50',
      WORKER_RECONCILIATION_LEASE_TTL_MS: '60000',
      WORKER_RECONCILIATION_INTERVAL_MS: '15000',
      WORKER_RECONCILIATION_CONCURRENCY: '10',
    });
    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.data.WORKER_RECONCILIATION_BATCH_SIZE).toBe(50);
      expect(result.data.WORKER_RECONCILIATION_LEASE_TTL_MS).toBe(60_000);
      expect(result.data.WORKER_RECONCILIATION_INTERVAL_MS).toBe(15_000);
      expect(result.data.WORKER_RECONCILIATION_CONCURRENCY).toBe(10);
    }
  });

  it('rejects WORKER_RECONCILIATION_BATCH_SIZE above the upper bound', () => {
    const result = parseWorkerEnvironment({
      ...workerValid,
      WORKER_RECONCILIATION_BATCH_SIZE: '500',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('WORKER_RECONCILIATION_BATCH_SIZE');
    }
  });

  it('rejects WORKER_RECONCILIATION_BATCH_SIZE below the lower bound', () => {
    const result = parseWorkerEnvironment({
      ...workerValid,
      WORKER_RECONCILIATION_BATCH_SIZE: '0',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('WORKER_RECONCILIATION_BATCH_SIZE');
    }
  });

  it('rejects WORKER_RECONCILIATION_LEASE_TTL_MS above the upper bound', () => {
    const result = parseWorkerEnvironment({
      ...workerValid,
      WORKER_RECONCILIATION_LEASE_TTL_MS: '950000',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('WORKER_RECONCILIATION_LEASE_TTL_MS');
    }
  });

  it('rejects WORKER_RECONCILIATION_INTERVAL_MS below the lower bound', () => {
    const result = parseWorkerEnvironment({
      ...workerValid,
      WORKER_RECONCILIATION_INTERVAL_MS: '500',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('WORKER_RECONCILIATION_INTERVAL_MS');
    }
  });

  it('rejects WORKER_RECONCILIATION_CONCURRENCY above the upper bound', () => {
    const result = parseWorkerEnvironment({
      ...workerValid,
      WORKER_RECONCILIATION_CONCURRENCY: '50',
    });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.error.message).toContain('WORKER_RECONCILIATION_CONCURRENCY');
    }
  });
});
