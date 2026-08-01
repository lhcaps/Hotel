import { z } from 'zod';

type EnvironmentSource = Record<string, string | undefined>;

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']);
const logLevelSchema = z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']);
const positivePort = z.coerce.number().int().min(1).max(65535);
const urlSchema = z.string().url();
const enabledSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const momoEnvironmentSchema = z.enum(['sandbox', 'production']).default('sandbox');
const momoRequestTypeSchema = z.literal('captureWallet').default('captureWallet');
const momoTimeoutSchema = z.coerce.number().int().min(30_000).max(30_000).default(30_000);
const vnpayEnvironmentSchema = z.enum(['sandbox', 'production']).default('sandbox');
const vnpayTimeoutSchema = z.coerce.number().int().min(1_000).max(30_000).default(10_000);
const googleAuthEnabledSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const googleClientIdSchema = z.string().min(8).max(512);
const googleClientSecretSchema = z.string().min(16).max(1024);
const googleRedirectUriSchema = z.string().url();
const googleTranslationTimeoutSchema = z.coerce.number().int().min(500).max(10_000).default(3_000);

// Phase 8B.1 (Gate B) — payment reconciliation settings. The API process
// runs the synchronous reconciliation surface (admin views, status checks)
// and the worker process runs the background claim batch. Both processes
// MUST agree on the same retry schedule and attempt ceiling, so the
// `PAYMENT_RECONCILIATION_*` settings are declared in both the API and
// worker schemas. All values are validated with safe bounded defaults so
// a misconfigured server cannot disable retries or explode the worker.
const paymentReconciliationMaxAttemptsSchema = z.coerce
  .number()
  .int()
  .min(1, { message: 'must be >= 1' })
  .max(32, { message: 'must be <= 32' })
  .default(8);
const paymentReconciliationRetryDelaySchema = z.coerce
  .number()
  .int()
  .min(1_000, { message: 'must be >= 1000 ms' })
  .max(86_400_000, { message: 'must be <= 86_400_000 ms (24h)' });
const paymentReconciliationRetryDelaysSchema = z
  .string()
  .default('60000,300000,900000,3600000,14400000')
  .transform((value, context) => {
    const raw = value.split(',').map((entry) => entry.trim());
    if (raw.length === 0 || raw.some((entry) => entry.length === 0)) {
      context.addIssue({
        code: 'custom',
        message:
          'PAYMENT_RECONCILIATION_RETRY_DELAYS_MS must be a comma-separated list of integers',
      });
      return z.NEVER;
    }
    const parsed: number[] = [];
    for (const entry of raw) {
      const result = paymentReconciliationRetryDelaySchema.safeParse(entry);
      if (!result.success) {
        context.addIssue({
          code: 'custom',
          message: `PAYMENT_RECONCILIATION_RETRY_DELAYS_MS entry ${entry} is invalid: ${result.error.issues[0]?.message ?? 'must be a bounded integer ms value'}`,
        });
        return z.NEVER;
      }
      parsed.push(result.data);
    }
    for (let i = 1; i < parsed.length; i += 1) {
      const previous = parsed[i - 1];
      const current = parsed[i];
      if (previous === undefined || current === undefined) continue;
      if (current <= previous) {
        context.addIssue({
          code: 'custom',
          message: 'PAYMENT_RECONCILIATION_RETRY_DELAYS_MS must be strictly increasing',
        });
        return z.NEVER;
      }
    }
    return parsed;
  });
const workerReconciliationBatchSizeSchema = z.coerce
  .number()
  .int()
  .min(1, { message: 'must be >= 1' })
  .max(100, { message: 'must be <= 100' })
  .default(25);
const workerReconciliationLeaseTtlMsSchema = z.coerce
  .number()
  .int()
  .min(1_000, { message: 'must be >= 1000 ms' })
  .max(900_000, { message: 'must be <= 900_000 ms (15m)' })
  .default(120_000);
const workerReconciliationIntervalMsSchema = z.coerce
  .number()
  .int()
  .min(1_000, { message: 'must be >= 1000 ms' })
  .max(3_600_000, { message: 'must be <= 3_600_000 ms (1h)' })
  .default(30_000);
const workerReconciliationConcurrencySchema = z.coerce
  .number()
  .int()
  .min(1, { message: 'must be >= 1' })
  .max(25, { message: 'must be <= 25' })
  .default(5);

function isLoopbackUrl(value: string): boolean {
  const hostname = new URL(value).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/** Returns the only equivalent browser loopback origin for local HTTP. */
export function loopbackOriginAlias(value: string): string | undefined {
  const origin = new URL(value);
  if (
    origin.protocol !== 'http:' ||
    (origin.hostname !== 'localhost' && origin.hostname !== '127.0.0.1')
  ) {
    return undefined;
  }
  origin.hostname = origin.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  return origin.origin;
}

function isGooglePlaceholderClientId(value: string): boolean {
  const lowered = value.toLowerCase();
  return (
    lowered.startsWith('placeholder') ||
    lowered.startsWith('test-') ||
    lowered.includes('your-google') ||
    lowered === 'changeme'
  );
}

function isGooglePlaceholderClientSecret(value: string): boolean {
  const lowered = value.toLowerCase();
  return lowered.startsWith('test-') || lowered.includes('placeholder');
}

function isMomoSandboxUrl(value: string): boolean {
  return new URL(value).hostname === 'test-payment.momo.vn';
}

function isVnpaySandboxUrl(value: string): boolean {
  return new URL(value).hostname === 'sandbox.vnpayment.vn';
}

/**
 * Returns the simulator host (host:port) when the configured
 * `PAYMENT_SIMULATOR_BASE_URL` points at a loopback origin. The local
 * demo simulator is the only legitimate consumer; production
 * deployments never set this variable, so the helper returns
 * `undefined` outside demos and the surrounding guard stays a hard no.
 */
function simulatorLoopbackHost(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:') return null;
  const hostname = parsed.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') return null;
  return parsed.host;
}

function isSimulatorBackedLoopbackUrl(url: string, simulatorHost: string | null): boolean {
  if (simulatorHost === null) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:') return false;
  const hostname = parsed.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') return false;
  return parsed.host === simulatorHost;
}

/**
 * Returns `true` when `url` points at the API's loopback webhook/return
 * path. The demo simulator posts its IPNs to the API at port 3101, so
 * the configured `MOMO_IPN_URL` / `MOMO_RETURN_URL` legitimately use a
 * different loopback port than the simulator itself.
 */
function isApiLoopbackUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:') return false;
  const hostname = parsed.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function addIssue(context: z.RefinementCtx, path: string, message: string): void {
  context.addIssue({ code: 'custom', path: [path], message });
}

const sharedEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema,
  LOG_LEVEL: logLevelSchema,
});

const apiEnvironmentSchema = sharedEnvironmentSchema
  .extend({
    API_HOST: z.string().min(1),
    API_PORT: positivePort,
    WEB_ORIGIN: urlSchema,
    DATABASE_URL: urlSchema,
    REDIS_URL: urlSchema,
    MAIL_HOST: z.string().min(1),
    MAIL_PORT: positivePort,
    MAIL_FROM: z.string().email(),
    BETTER_AUTH_SECRET: z.string().min(32),
    AUTH_BASE_URL: urlSchema,
    GUEST_OTP_SECRET: z.string().min(32),
    GUEST_CHALLENGE_REF_SECRET: z.string().min(32),
    GUEST_SESSION_SECRET: z.string().min(32),
    BOOKING_IP_DIGEST_SECRET: z.string().min(32),
    BOOKING_HOLD_DURATION_MS: z.coerce.number().int().min(60_000).max(3_600_000).default(900_000),
    GUEST_OTP_TTL_MS: z.coerce.number().int().min(60_000).max(3_600_000).default(600_000),
    GUEST_OTP_RESEND_COOLDOWN_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
    GUEST_OTP_REQUEST_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(86_400_000)
      .default(900_000),
    GUEST_OTP_REQUEST_LIMIT: z.coerce.number().int().min(1).max(1_000).default(3),
    GUEST_OTP_IP_WINDOW_MS: z.coerce.number().int().min(60_000).max(86_400_000).default(3_600_000),
    GUEST_OTP_IP_LIMIT: z.coerce.number().int().min(1).max(100_000).default(20),
    GUEST_SESSION_TTL_MS: z.coerce.number().int().min(60_000).max(86_400_000).default(1_800_000),
    TRUSTED_PROXY_CIDRS: z.string().default(''),
    MOMO_ENABLED: enabledSchema,
    MOMO_ENVIRONMENT: momoEnvironmentSchema,
    MOMO_PARTNER_CODE: z.string().min(1).max(50).optional(),
    MOMO_ACCESS_KEY: z.string().min(1).max(200).optional(),
    MOMO_SECRET_KEY: z.string().min(32).max(512).optional(),
    MOMO_API_BASE_URL: z.string().url().optional(),
    MOMO_RETURN_URL: z.string().url().optional(),
    MOMO_IPN_URL: z.string().url().optional(),
    MOMO_REQUEST_TYPE: momoRequestTypeSchema,
    MOMO_REQUEST_TIMEOUT_MS: momoTimeoutSchema,
    // Optional loopback payment provider simulator URL. When set and
    // pointing at loopback, the MoMo/VNPAY URL validators allow
    // simulator-backed loopback redirects. Production never sets this
    // variable so the allowlist is a no-op in production.
    PAYMENT_SIMULATOR_BASE_URL: z.string().url().optional(),
    // Explicit production-only boundary for the dedicated no-money payment
    // demo service. This is separate from PAYMENT_SIMULATOR_BASE_URL, which
    // remains loopback-only test infrastructure.
    PAYMENT_DEMO_ENABLED: enabledSchema,
    PAYMENT_DEMO_PUBLIC_ORIGIN: z.string().url().optional(),
    PAYMENT_DEMO_INTERNAL_BASE_URL: z.string().url().optional(),
    PAYMENT_DEMO_CONTROL_TOKEN: z.string().min(32).max(512).optional(),
    VNPAY_ENABLED: enabledSchema,
    VNPAY_ENVIRONMENT: vnpayEnvironmentSchema,
    VNPAY_TMN_CODE: z.string().min(1).max(32).optional(),
    VNPAY_HASH_SECRET: z.string().min(32).max(512).optional(),
    VNPAY_API_BASE_URL: z.string().url().optional(),
    VNPAY_RETURN_URL: z.string().url().optional(),
    VNPAY_IPN_URL: z.string().url().optional(),
    VNPAY_REQUEST_TIMEOUT_MS: vnpayTimeoutSchema,
    GOOGLE_AUTH_ENABLED: googleAuthEnabledSchema,
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
    GOOGLE_AUTH_BASE_URL: z.string().url().optional(),
    // Dynamic descriptions only. Static application UI uses local typed dictionaries.
    // This key is deliberately server-only: no NEXT_PUBLIC mirror exists.
    GOOGLE_TRANSLATION_ENABLED: enabledSchema,
    GOOGLE_TRANSLATION_API_KEY: z.string().min(20).max(1024).optional(),
    GOOGLE_TRANSLATION_TIMEOUT_MS: googleTranslationTimeoutSchema,
    // Phase 7F deterministic OAuth harness. Only honored when
    // NODE_ENV='test'; never active in production or development. The
    // test harness spins up a local OIDC/OAuth2 server on a known
    // loopback port and points Better Auth's genericOAuth plugin at it.
    // The Google provider is left untouched; this configuration is an
    // additive test surface used to exercise the same Better Auth
    // sign-in / callback / code exchange / user & account creation
    // paths that the production Google provider would otherwise use.
    ROOM_TEST_OAUTH_PROVIDER_ID: z.string().optional(),
    ROOM_TEST_OAUTH_CLIENT_ID: z.string().optional(),
    ROOM_TEST_OAUTH_CLIENT_SECRET: z.string().optional(),
    ROOM_TEST_OAUTH_AUTHORIZATION_URL: z.string().url().optional(),
    ROOM_TEST_OAUTH_TOKEN_URL: z.string().url().optional(),
    ROOM_TEST_OAUTH_USERINFO_URL: z.string().url().optional(),
    ROOM_TEST_OAUTH_SCOPES: z.string().optional(),
    // Phase 7F browser-test mode switch. Server-only: the value is read
    // by the customer login server component to derive which sign-in
    // control to render. It is never exposed through a NEXT_PUBLIC
    // variable and never reaches the browser as a literal env value.
    // Disabled/absent by default. Refused in production. When true,
    // every ROOM_TEST_OAUTH_* URL must resolve to a loopback host.
    // Cannot enable a fake production auth route, cannot disable Google
    // security or authentication checks, and cannot bypass session
    // requirements.
    ROOM_TEST_OAUTH_BROWSER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // Phase 8B.1 (Gate B) — payment reconciliation settings shared by
    // the API and worker processes. The values are validated with safe
    // bounded defaults so a misconfigured server cannot disable retries
    // or explode the worker. The shared MAX_ATTEMPTS ceiling and the
    // strictly-increasing retry schedule are read by the API render
    // surface and the worker batch process; both must agree.
    PAYMENT_RECONCILIATION_MAX_ATTEMPTS: paymentReconciliationMaxAttemptsSchema,
    PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: paymentReconciliationRetryDelaysSchema,
  })
  .superRefine((value, context) => {
    if (value.PAYMENT_RECONCILIATION_MAX_ATTEMPTS > 0) {
      const delays = value.PAYMENT_RECONCILIATION_RETRY_DELAYS_MS;
      if (delays.length > value.PAYMENT_RECONCILIATION_MAX_ATTEMPTS) {
        addIssue(
          context,
          'PAYMENT_RECONCILIATION_RETRY_DELAYS_MS',
          'must have at most PAYMENT_RECONCILIATION_MAX_ATTEMPTS entries',
        );
      }
    }
    if (value.NODE_ENV === 'production') {
      for (const key of ['WEB_ORIGIN', 'DATABASE_URL', 'REDIS_URL'] as const) {
        if (new URL(value[key]).hostname === 'localhost') {
          addIssue(context, key, 'must not use localhost in production');
        }
      }

      for (const key of [
        'GUEST_OTP_SECRET',
        'GUEST_CHALLENGE_REF_SECRET',
        'GUEST_SESSION_SECRET',
        'BOOKING_IP_DIGEST_SECRET',
      ] as const) {
        if (
          value[key] === 'test-guest-otp-secret-32-chars-min-aaaaaa' ||
          value[key] === 'test-challenge-ref-secret-32-chars-aaaa' ||
          value[key] === 'test-guest-session-secret-32-chars-aaaa' ||
          value[key] === 'test-ip-digest-secret-32-chars-aaaaa'
        ) {
          addIssue(context, key, `Production ${key} must not use the test placeholder value`);
        }
      }
    }

    if (value.PAYMENT_DEMO_ENABLED) {
      for (const key of [
        'PAYMENT_DEMO_PUBLIC_ORIGIN',
        'PAYMENT_DEMO_INTERNAL_BASE_URL',
        'PAYMENT_DEMO_CONTROL_TOKEN',
      ] as const) {
        if (value[key] === undefined) {
          addIssue(context, key, 'is required when PAYMENT_DEMO_ENABLED=true');
        }
      }
      if (value.NODE_ENV !== 'production') {
        addIssue(
          context,
          'PAYMENT_DEMO_ENABLED',
          'is only allowed in production; use the loopback test simulator locally',
        );
      }
      if (value.PAYMENT_SIMULATOR_BASE_URL !== undefined) {
        addIssue(
          context,
          'PAYMENT_SIMULATOR_BASE_URL',
          'must be absent when PAYMENT_DEMO_ENABLED=true',
        );
      }
      if (
        value.PAYMENT_DEMO_PUBLIC_ORIGIN !== undefined &&
        value.PAYMENT_DEMO_INTERNAL_BASE_URL !== undefined
      ) {
        const publicOrigin = new URL(value.PAYMENT_DEMO_PUBLIC_ORIGIN);
        const internal = new URL(value.PAYMENT_DEMO_INTERNAL_BASE_URL);
        if (publicOrigin.protocol !== 'https:' || isLoopbackUrl(publicOrigin.toString())) {
          addIssue(
            context,
            'PAYMENT_DEMO_PUBLIC_ORIGIN',
            'must use a non-loopback HTTPS origin in production',
          );
        }
        if (internal.protocol !== 'http:' && internal.protocol !== 'https:') {
          addIssue(context, 'PAYMENT_DEMO_INTERNAL_BASE_URL', 'must use HTTP or HTTPS');
        }
        if (internal.hostname === publicOrigin.hostname) {
          addIssue(
            context,
            'PAYMENT_DEMO_INTERNAL_BASE_URL',
            'must use the private service origin, not the public payment origin',
          );
        }
      }
      if (!value.MOMO_ENABLED || !value.VNPAY_ENABLED) {
        addIssue(
          context,
          'PAYMENT_DEMO_ENABLED',
          'requires both MOMO_ENABLED and VNPAY_ENABLED to be true',
        );
      }
      if (
        value.PAYMENT_DEMO_PUBLIC_ORIGIN !== undefined &&
        value.MOMO_API_BASE_URL !== undefined &&
        new URL(value.PAYMENT_DEMO_PUBLIC_ORIGIN).origin !== new URL(value.MOMO_API_BASE_URL).origin
      ) {
        addIssue(context, 'MOMO_API_BASE_URL', 'must use PAYMENT_DEMO_PUBLIC_ORIGIN');
      }
      if (
        value.PAYMENT_DEMO_PUBLIC_ORIGIN !== undefined &&
        value.VNPAY_API_BASE_URL !== undefined &&
        new URL(value.PAYMENT_DEMO_PUBLIC_ORIGIN).origin !==
          new URL(value.VNPAY_API_BASE_URL).origin
      ) {
        addIssue(context, 'VNPAY_API_BASE_URL', 'must use PAYMENT_DEMO_PUBLIC_ORIGIN');
      }
      for (const key of [
        'MOMO_RETURN_URL',
        'MOMO_IPN_URL',
        'VNPAY_RETURN_URL',
        'VNPAY_IPN_URL',
      ] as const) {
        const candidate = value[key];
        if (
          candidate !== undefined &&
          new URL(candidate).origin !== new URL(value.WEB_ORIGIN).origin
        ) {
          addIssue(context, key, 'must use the public WEB_ORIGIN callback host');
        }
      }
    }

    if (value.GOOGLE_TRANSLATION_ENABLED && value.GOOGLE_TRANSLATION_API_KEY === undefined) {
      addIssue(
        context,
        'GOOGLE_TRANSLATION_API_KEY',
        'is required when GOOGLE_TRANSLATION_ENABLED=true',
      );
    }

    if (value.MOMO_ENABLED) {
      for (const key of [
        'MOMO_PARTNER_CODE',
        'MOMO_ACCESS_KEY',
        'MOMO_SECRET_KEY',
        'MOMO_API_BASE_URL',
        'MOMO_RETURN_URL',
        'MOMO_IPN_URL',
      ] as const) {
        if (value[key] === undefined) addIssue(context, key, 'is required when MOMO_ENABLED=true');
      }
      if (
        value.MOMO_API_BASE_URL !== undefined &&
        value.MOMO_RETURN_URL !== undefined &&
        value.MOMO_IPN_URL !== undefined
      ) {
        const urls = [value.MOMO_API_BASE_URL, value.MOMO_RETURN_URL, value.MOMO_IPN_URL];
        const parsedUrls = urls.map((url) => {
          try {
            return new URL(url);
          } catch {
            return undefined;
          }
        });
        const validUrls = parsedUrls.filter((url): url is URL => url !== undefined);
        if (validUrls.length !== urls.length) return;
        if (validUrls.some((url) => url.protocol !== 'https:')) {
          const simulatorHost = simulatorLoopbackHost(value.PAYMENT_SIMULATOR_BASE_URL);
          // The MoMo API base URL may point at the simulator; the
          // return/IPN URLs intentionally point at the API itself so the
          // simulator can POST signed IPNs back. Both paths must be
          // loopback HTTP under the simulator-driven local demo.
          const apiBaseOk =
            simulatorHost !== null &&
            value.MOMO_API_BASE_URL !== undefined &&
            isSimulatorBackedLoopbackUrl(value.MOMO_API_BASE_URL, simulatorHost);
          const returnOk =
            value.MOMO_RETURN_URL !== undefined && isApiLoopbackUrl(value.MOMO_RETURN_URL);
          const ipnOk = value.MOMO_IPN_URL !== undefined && isApiLoopbackUrl(value.MOMO_IPN_URL);
          const loopbackTestAdapter =
            value.NODE_ENV === 'test' &&
            validUrls.every((url) => url.protocol === 'http:' && isLoopbackUrl(url.toString()));
          if (!((apiBaseOk && returnOk && ipnOk) || loopbackTestAdapter)) {
            for (const key of ['MOMO_API_BASE_URL', 'MOMO_RETURN_URL', 'MOMO_IPN_URL'] as const) {
              if (value[key] !== undefined && new URL(value[key] as string).protocol !== 'https:') {
                addIssue(
                  context,
                  key,
                  'must use HTTPS outside the deliberate test loopback adapter',
                );
              }
            }
          }
        }
        if (value.MOMO_ENVIRONMENT === 'production') {
          if (isMomoSandboxUrl(value.MOMO_API_BASE_URL)) {
            addIssue(
              context,
              'MOMO_API_BASE_URL',
              'must not use the MoMo sandbox endpoint in production',
            );
          }
          for (const key of ['MOMO_RETURN_URL', 'MOMO_IPN_URL'] as const) {
            if (isLoopbackUrl(value[key] as string))
              addIssue(context, key, 'must not use loopback in production');
          }
          if (
            value.MOMO_SECRET_KEY === undefined ||
            value.MOMO_SECRET_KEY.includes('test-') ||
            value.MOMO_SECRET_KEY.includes('placeholder')
          ) {
            addIssue(context, 'MOMO_SECRET_KEY', 'must not use a placeholder value in production');
          }
        } else if (
          isMomoSandboxUrl(value.MOMO_API_BASE_URL) === false &&
          value.NODE_ENV !== 'test'
        ) {
          // The simulator-backed branch above already covers the local
          // demo. Outside `test` and outside the simulator we still pin
          // MoMo sandbox URLs.
          const simulatorHost = simulatorLoopbackHost(value.PAYMENT_SIMULATOR_BASE_URL);
          if (simulatorHost === null) {
            addIssue(context, 'MOMO_API_BASE_URL', 'must use the locked MoMo sandbox endpoint');
          }
        }
      }
    }

    if (value.GOOGLE_AUTH_ENABLED) {
      if (value.GOOGLE_CLIENT_ID === undefined) {
        addIssue(context, 'GOOGLE_CLIENT_ID', 'is required when GOOGLE_AUTH_ENABLED=true');
      } else {
        const parsedId = googleClientIdSchema.safeParse(value.GOOGLE_CLIENT_ID);
        if (!parsedId.success) {
          addIssue(context, 'GOOGLE_CLIENT_ID', 'must be 8..512 characters');
        } else if (
          value.NODE_ENV === 'production' &&
          isGooglePlaceholderClientId(value.GOOGLE_CLIENT_ID)
        ) {
          addIssue(context, 'GOOGLE_CLIENT_ID', 'must not use a placeholder value in production');
        }
      }
      if (value.GOOGLE_CLIENT_SECRET === undefined) {
        addIssue(context, 'GOOGLE_CLIENT_SECRET', 'is required when GOOGLE_AUTH_ENABLED=true');
      } else {
        const parsedSecret = googleClientSecretSchema.safeParse(value.GOOGLE_CLIENT_SECRET);
        if (!parsedSecret.success) {
          addIssue(context, 'GOOGLE_CLIENT_SECRET', 'must be 16..1024 characters');
        } else if (
          value.NODE_ENV === 'production' &&
          isGooglePlaceholderClientSecret(value.GOOGLE_CLIENT_SECRET)
        ) {
          addIssue(
            context,
            'GOOGLE_CLIENT_SECRET',
            'must not use a placeholder value in production',
          );
        }
      }
      if (value.GOOGLE_REDIRECT_URI === undefined) {
        addIssue(context, 'GOOGLE_REDIRECT_URI', 'is required when GOOGLE_AUTH_ENABLED=true');
      } else {
        const parsedRedirect = googleRedirectUriSchema.safeParse(value.GOOGLE_REDIRECT_URI);
        if (!parsedRedirect.success) {
          addIssue(context, 'GOOGLE_REDIRECT_URI', 'must be a valid URL');
        } else {
          try {
            const redirect = new URL(value.GOOGLE_REDIRECT_URI);
            const loopback = isLoopbackUrl(value.GOOGLE_REDIRECT_URI);
            if (value.NODE_ENV === 'production') {
              if (redirect.protocol !== 'https:') {
                addIssue(context, 'GOOGLE_REDIRECT_URI', 'must use HTTPS in production');
              }
              if (loopback) {
                addIssue(
                  context,
                  'GOOGLE_REDIRECT_URI',
                  'must not use a loopback host in production',
                );
              }
              const webOriginHost = (() => {
                try {
                  return new URL(value.WEB_ORIGIN).hostname;
                } catch {
                  return null;
                }
              })();
              if (webOriginHost !== null && redirect.hostname !== webOriginHost) {
                addIssue(
                  context,
                  'GOOGLE_REDIRECT_URI',
                  'must share the configured WEB_ORIGIN host',
                );
              }
            } else if (value.NODE_ENV !== 'test' && redirect.protocol !== 'https:' && !loopback) {
              addIssue(
                context,
                'GOOGLE_REDIRECT_URI',
                'must use HTTPS outside the deliberate test loopback adapter',
              );
            }
          } catch {
            addIssue(context, 'GOOGLE_REDIRECT_URI', 'must be a valid URL');
          }
        }
      }
      if (
        value.GOOGLE_AUTH_BASE_URL !== undefined &&
        value.GOOGLE_AUTH_BASE_URL !== value.AUTH_BASE_URL
      ) {
        try {
          const candidate = new URL(value.GOOGLE_AUTH_BASE_URL);
          if (
            value.NODE_ENV === 'production' &&
            (candidate.protocol !== 'https:' || isLoopbackUrl(value.GOOGLE_AUTH_BASE_URL))
          ) {
            addIssue(
              context,
              'GOOGLE_AUTH_BASE_URL',
              'must use HTTPS without loopback in production',
            );
          }
        } catch {
          addIssue(context, 'GOOGLE_AUTH_BASE_URL', 'must be a valid URL');
        }
      }
    }

    // Deterministic OAuth harness: the URL variables are honored when
    // NODE_ENV is not production. Production deployments must never
    // accept test OIDC URLs. The browser-mode switch below adds the
    // stronger loopback guard when the harness is wired into the
    // customer login page.
    const testOAuthKeys = [
      'ROOM_TEST_OAUTH_PROVIDER_ID',
      'ROOM_TEST_OAUTH_CLIENT_ID',
      'ROOM_TEST_OAUTH_CLIENT_SECRET',
      'ROOM_TEST_OAUTH_AUTHORIZATION_URL',
      'ROOM_TEST_OAUTH_TOKEN_URL',
      'ROOM_TEST_OAUTH_USERINFO_URL',
    ] as const;
    const hasAnyTestOAuth = testOAuthKeys.some((key) => value[key] !== undefined);
    if (hasAnyTestOAuth && value.NODE_ENV === 'production') {
      for (const key of testOAuthKeys) {
        if (value[key] !== undefined) {
          addIssue(
            context,
            key,
            'is only honored outside production; the deterministic OAuth harness is a non-production surface',
          );
        }
      }
    }
    if (value.NODE_ENV !== 'production' && hasAnyTestOAuth) {
      for (const key of testOAuthKeys) {
        if (value[key] === undefined) {
          addIssue(context, key, 'must be set when any other ROOM_TEST_OAUTH_* variable is set');
        }
      }
    }

    // Phase 7F browser-test mode switch. Server-only. Refused in
    // production. When enabled, every ROOM_TEST_OAUTH_* URL must
    // resolve to a loopback host so the browser cannot be redirected
    // to a third-party identity provider under the test surface.
    if (value.ROOM_TEST_OAUTH_BROWSER_ENABLED) {
      if (value.NODE_ENV === 'production') {
        addIssue(
          context,
          'ROOM_TEST_OAUTH_BROWSER_ENABLED',
          'must be false in production; the browser-test mode is a test-only surface',
        );
      } else if (value.NODE_ENV !== 'test' && value.NODE_ENV !== 'development') {
        addIssue(
          context,
          'ROOM_TEST_OAUTH_BROWSER_ENABLED',
          'is only honored under NODE_ENV=test or NODE_ENV=development',
        );
      } else {
        const browserTestUrlKeys = [
          'ROOM_TEST_OAUTH_AUTHORIZATION_URL',
          'ROOM_TEST_OAUTH_TOKEN_URL',
          'ROOM_TEST_OAUTH_USERINFO_URL',
        ] as const;
        for (const key of browserTestUrlKeys) {
          const url = value[key];
          if (url === undefined) {
            addIssue(
              context,
              'ROOM_TEST_OAUTH_BROWSER_ENABLED',
              `requires ${key} to be set to a loopback URL`,
            );
            continue;
          }
          if (!isLoopbackUrl(url)) {
            addIssue(
              context,
              key,
              'must use a loopback host (127.0.0.1, localhost, or ::1) when ROOM_TEST_OAUTH_BROWSER_ENABLED=true',
            );
          }
        }
      }
    }

    if (!value.VNPAY_ENABLED) return;
    for (const key of [
      'VNPAY_TMN_CODE',
      'VNPAY_HASH_SECRET',
      'VNPAY_API_BASE_URL',
      'VNPAY_RETURN_URL',
      'VNPAY_IPN_URL',
    ] as const) {
      if (value[key] === undefined) addIssue(context, key, 'is required when VNPAY_ENABLED=true');
    }
    if (
      value.VNPAY_API_BASE_URL === undefined ||
      value.VNPAY_RETURN_URL === undefined ||
      value.VNPAY_IPN_URL === undefined
    )
      return;
    const urls = [value.VNPAY_API_BASE_URL, value.VNPAY_RETURN_URL, value.VNPAY_IPN_URL];
    const parsedUrls = urls.map((url) => {
      try {
        return new URL(url);
      } catch {
        return undefined;
      }
    });
    const validUrls = parsedUrls.filter((url): url is URL => url !== undefined);
    if (validUrls.length !== urls.length) return;
    if (validUrls.some((url) => url.protocol !== 'https:')) {
      const simulatorHost = simulatorLoopbackHost(value.PAYMENT_SIMULATOR_BASE_URL);
      // The VNPay API base URL points at the simulator pay page;
      // return/IPN URLs intentionally point at the API itself so the
      // simulator can POST signed IPNs back.
      const apiBaseOk =
        simulatorHost !== null &&
        value.VNPAY_API_BASE_URL !== undefined &&
        isSimulatorBackedLoopbackUrl(value.VNPAY_API_BASE_URL, simulatorHost);
      const returnOk =
        value.VNPAY_RETURN_URL !== undefined && isApiLoopbackUrl(value.VNPAY_RETURN_URL);
      const ipnOk = value.VNPAY_IPN_URL !== undefined && isApiLoopbackUrl(value.VNPAY_IPN_URL);
      const loopbackTestAdapter =
        value.NODE_ENV === 'test' &&
        validUrls.every((url) => url.protocol === 'http:' && isLoopbackUrl(url.toString()));
      if (!((apiBaseOk && returnOk && ipnOk) || loopbackTestAdapter)) {
        for (const key of ['VNPAY_API_BASE_URL', 'VNPAY_RETURN_URL', 'VNPAY_IPN_URL'] as const) {
          if (value[key] !== undefined && new URL(value[key] as string).protocol !== 'https:') {
            addIssue(context, key, 'must use HTTPS outside the deliberate test loopback adapter');
          }
        }
      }
    }
    if (value.VNPAY_ENVIRONMENT === 'production') {
      if (isVnpaySandboxUrl(value.VNPAY_API_BASE_URL)) {
        addIssue(
          context,
          'VNPAY_API_BASE_URL',
          'must not use the VNPAY sandbox endpoint in production',
        );
      }
      for (const key of ['VNPAY_RETURN_URL', 'VNPAY_IPN_URL'] as const) {
        if (isLoopbackUrl(value[key] as string))
          addIssue(context, key, 'must not use loopback in production');
      }
      if (
        value.VNPAY_HASH_SECRET === undefined ||
        value.VNPAY_HASH_SECRET.includes('test-') ||
        value.VNPAY_HASH_SECRET.includes('placeholder')
      ) {
        addIssue(context, 'VNPAY_HASH_SECRET', 'must not use a placeholder value in production');
      }
    } else if (isVnpaySandboxUrl(value.VNPAY_API_BASE_URL) === false && value.NODE_ENV !== 'test') {
      const simulatorHost = simulatorLoopbackHost(value.PAYMENT_SIMULATOR_BASE_URL);
      if (simulatorHost === null) {
        addIssue(context, 'VNPAY_API_BASE_URL', 'must use the locked VNPAY sandbox endpoint');
      }
    }
  });

const webEnvironmentSchema = sharedEnvironmentSchema
  .extend({
    WEB_PORT: positivePort,
    NEXT_PUBLIC_API_BASE_URL: urlSchema,
    INTERNAL_API_BASE_URL: urlSchema,
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // Phase 7F browser-test mode switch. Server-only: read by the
    // customer login server component to derive which sign-in control
    // to render. Never NEXT_PUBLIC. Refused in production. When true,
    // the test OAuth provider id is required so the client component
    // can target the correct Better Auth generic-OAuth endpoint.
    ROOM_TEST_OAUTH_BROWSER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    ROOM_TEST_OAUTH_PROVIDER_ID: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.ROOM_TEST_OAUTH_BROWSER_ENABLED) {
      if (value.NODE_ENV === 'production') {
        addIssue(
          context,
          'ROOM_TEST_OAUTH_BROWSER_ENABLED',
          'must be false in production; the browser-test mode is a test-only surface',
        );
      } else if (
        value.ROOM_TEST_OAUTH_PROVIDER_ID === undefined ||
        value.ROOM_TEST_OAUTH_PROVIDER_ID.length === 0
      ) {
        addIssue(
          context,
          'ROOM_TEST_OAUTH_PROVIDER_ID',
          'is required when ROOM_TEST_OAUTH_BROWSER_ENABLED=true',
        );
      }
    }
  });

const workerEnvironmentSchema = sharedEnvironmentSchema
  .extend({
    DATABASE_URL: urlSchema,
    REDIS_URL: urlSchema,
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: positivePort,
    SMTP_SECURE: z.enum(['true', 'false']).transform((value) => value === 'true'),
    SMTP_FROM: z.string().email(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    GUEST_OTP_SECRET: z.string().min(32),
    GUEST_CHALLENGE_REF_SECRET: z.string().min(32),
    GUEST_SESSION_SECRET: z.string().min(32),
    BOOKING_IP_DIGEST_SECRET: z.string().min(32),
    PAYMENT_DEMO_ENABLED: enabledSchema,
    PAYMENT_DEMO_INTERNAL_BASE_URL: z.string().url().optional(),
    PAYMENT_DEMO_CONTROL_TOKEN: z.string().min(32).max(512).optional(),
    // Phase 8B.1 (Gate B) — payment reconciliation settings shared by
    // the API and worker processes. The worker process MUST agree with
    // the API on the same retry schedule and attempt ceiling so the
    // background claim batch honors the same upper bounds as the API
    // render surface.
    PAYMENT_RECONCILIATION_MAX_ATTEMPTS: paymentReconciliationMaxAttemptsSchema,
    PAYMENT_RECONCILIATION_RETRY_DELAYS_MS: paymentReconciliationRetryDelaysSchema,
    // Phase 8B.1 (Gate B) — worker-only reconciliation scheduling. The
    // batch size, lease TTL, poll interval, and concurrency are
    // controlled by the worker process; the API never reads them.
    WORKER_RECONCILIATION_BATCH_SIZE: workerReconciliationBatchSizeSchema,
    WORKER_RECONCILIATION_LEASE_TTL_MS: workerReconciliationLeaseTtlMsSchema,
    WORKER_RECONCILIATION_INTERVAL_MS: workerReconciliationIntervalMsSchema,
    WORKER_RECONCILIATION_CONCURRENCY: workerReconciliationConcurrencySchema,
  })
  .superRefine((value, context) => {
    if (value.PAYMENT_DEMO_ENABLED) {
      if (value.NODE_ENV !== 'production') {
        addIssue(context, 'PAYMENT_DEMO_ENABLED', 'is only allowed in production');
      }
      for (const key of ['PAYMENT_DEMO_INTERNAL_BASE_URL', 'PAYMENT_DEMO_CONTROL_TOKEN'] as const) {
        if (value[key] === undefined) {
          addIssue(context, key, 'is required when PAYMENT_DEMO_ENABLED=true');
        }
      }
    }
    if (value.PAYMENT_RECONCILIATION_MAX_ATTEMPTS > 0) {
      const delays = value.PAYMENT_RECONCILIATION_RETRY_DELAYS_MS;
      if (delays.length > value.PAYMENT_RECONCILIATION_MAX_ATTEMPTS) {
        context.addIssue({
          code: 'custom',
          path: ['PAYMENT_RECONCILIATION_RETRY_DELAYS_MS'],
          message: 'must have at most PAYMENT_RECONCILIATION_MAX_ATTEMPTS entries',
        });
      }
    }
    if (value.NODE_ENV === 'production') {
      for (const key of [
        'GUEST_OTP_SECRET',
        'GUEST_CHALLENGE_REF_SECRET',
        'GUEST_SESSION_SECRET',
        'BOOKING_IP_DIGEST_SECRET',
      ] as const) {
        if (
          value[key] === 'test-guest-otp-secret-32-chars-min-aaaaaa' ||
          value[key] === 'test-challenge-ref-secret-32-chars-aaaa' ||
          value[key] === 'test-guest-session-secret-32-chars-aaaa' ||
          value[key] === 'test-ip-digest-secret-32-chars-aaaaa'
        ) {
          context.addIssue({
            code: 'custom',
            message: `Production ${key} must not use the test placeholder value`,
            path: [key],
          });
        }
      }
      if (value.SMTP_HOST === 'localhost' || value.SMTP_HOST === '127.0.0.1') {
        return;
      }
      if (value.SMTP_USER === undefined || value.SMTP_PASSWORD === undefined) {
        context.addIssue({
          code: 'custom',
          message: 'SMTP_USER and SMTP_PASSWORD are required for non-loopback hosts in production',
          path: ['SMTP_USER'],
        });
      }
    }
  });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; error: Error };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

function parse<T>(schema: z.ZodType<T>, source: EnvironmentSource): ParseResult<T> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result;
  }

  const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ');
  return { success: false, error: new Error(`Invalid environment variables: ${names}`) };
}

export function parseApiEnvironment(source: EnvironmentSource): ParseResult<ApiEnvironment> {
  return parse(apiEnvironmentSchema, source);
}

export function parseWebEnvironment(source: EnvironmentSource): ParseResult<WebEnvironment> {
  return parse(webEnvironmentSchema, source);
}

export function parseWorkerEnvironment(source: EnvironmentSource): ParseResult<WorkerEnvironment> {
  return parse(workerEnvironmentSchema, source);
}

export function requireApiEnvironment(source: EnvironmentSource = process.env): ApiEnvironment {
  const result = parseApiEnvironment(source);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function requireWebEnvironment(source: EnvironmentSource = process.env): WebEnvironment {
  const result = parseWebEnvironment(source);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function requireWorkerEnvironment(
  source: EnvironmentSource = process.env,
): WorkerEnvironment {
  const result = parseWorkerEnvironment(source);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
