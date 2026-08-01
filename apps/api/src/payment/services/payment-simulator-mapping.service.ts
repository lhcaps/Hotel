import { createLogger } from '@room/observability';

const logger = createLogger({
  service: 'api',
  environment: process.env.NODE_ENV ?? 'unknown',
});

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

interface PublishMappingInput {
  readonly provider: 'momo' | 'vnpay';
  readonly orderId: string;
  readonly bookingCode: string;
}

interface MappingTarget {
  readonly baseUrl: string;
  readonly path: string;
  readonly authorization?: string;
}

function resolveMappingTarget(): MappingTarget | null {
  if (process.env.PAYMENT_DEMO_ENABLED === 'true') {
    const baseUrl = process.env.PAYMENT_DEMO_INTERNAL_BASE_URL;
    const controlToken = process.env.PAYMENT_DEMO_CONTROL_TOKEN;
    if (
      typeof baseUrl !== 'string' ||
      baseUrl.length === 0 ||
      typeof controlToken !== 'string' ||
      controlToken.length < 32
    ) {
      return null;
    }
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return {
        baseUrl: parsed.toString().replace(/\/+$/, ''),
        path: '/__internal/order-mapping',
        authorization: `Bearer ${controlToken}`,
      };
    } catch {
      return null;
    }
  }
  const raw = process.env.PAYMENT_SIMULATOR_BASE_URL;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  return { baseUrl: parsed.toString().replace(/\/+$/, ''), path: '/__sim/order-mapping' };
}

/**
 * Push an `(orderId → bookingCode)` mapping to the locally-running payment
 * demo payment service so its browser-side redirect can use the authoritative booking
 * code instead of the provider's opaque orderId. This is a non-production
 * side-effect: local simulator mapping remains loopback-only. The separately
 * configured public demo service uses a private Docker URL and a bearer token
 * before it accepts a mapping; it is never controlled from a browser.
 */
export async function publishSimulatorBookingCodeMapping(
  input: PublishMappingInput,
): Promise<void> {
  if (input.orderId.length === 0 || input.bookingCode.length === 0) return;
  const target = resolveMappingTarget();
  if (target === null) return;
  try {
    const response = await fetch(`${target.baseUrl}${target.path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(target.authorization === undefined ? {} : { authorization: target.authorization }),
      },
      body: JSON.stringify({
        orderId: input.orderId,
        bookingCode: input.bookingCode,
      }),
    });
    if (!response.ok) {
      logger.warn(
        {
          provider: input.provider,
          orderId: input.orderId,
          status: response.status,
        },
        'payment.simulator.mapping.pushFailed',
      );
    }
  } catch (error) {
    logger.warn(
      {
        provider: input.provider,
        orderId: input.orderId,
        message: error instanceof Error ? error.message : String(error),
      },
      'payment.simulator.mapping.unreachable',
    );
  }
}
