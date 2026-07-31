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

function resolveSimulatorBaseUrl(): string | null {
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
  return parsed.toString().replace(/\/+$/, '');
}

/**
 * Push an `(orderId → bookingCode)` mapping to the locally-running payment
 * simulator so its browser-side redirect can use the authoritative booking
 * code instead of the provider's opaque orderId. This is a non-production
 * side-effect: the simulator only binds to loopback, refuses non-loopback
 * callers, and refuses to start under NODE_ENV=production, so production
 * deployments short-circuit this helper before any HTTP call.
 */
export async function publishSimulatorBookingCodeMapping(
  input: PublishMappingInput,
): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  if (input.orderId.length === 0 || input.bookingCode.length === 0) return;
  const base = resolveSimulatorBaseUrl();
  if (base === null) return;
  try {
    const response = await fetch(`${base}/__sim/order-mapping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
