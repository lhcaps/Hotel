import { fileURLToPath } from 'node:url';

import { loadEnvironment } from '../../apps/payment-demo/main.mjs';
import {
  parseApiEnvironment,
  parseWebEnvironment,
  parseWorkerEnvironment,
} from '../../packages/config/src/index.ts';

type EnvironmentSource = Record<string, string | undefined>;

function requireUrl(source: EnvironmentSource, key: string): URL {
  const value = source[key];
  if (value === undefined || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  try {
    return new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
}

function requireParsed(name: string, result: ReturnType<typeof parseApiEnvironment>): void {
  if (!result.success) {
    // The config package deliberately includes only variable names in this
    // message, so the deployment preflight never renders a secret value.
    throw new Error(`${name} environment rejected: ${result.error.message}`);
  }
}

function requireExactUrl(source: EnvironmentSource, key: string, expected: URL): void {
  if (requireUrl(source, key).toString() !== expected.toString()) {
    throw new Error(`${key} does not match the payment-demo deployment contract`);
  }
}

export function validateProviderUrlAuthority(source: EnvironmentSource): void {
  const paymentDemoOrigin = requireUrl(source, 'PAYMENT_DEMO_PUBLIC_ORIGIN');
  const webOrigin = requireUrl(source, 'WEB_ORIGIN');

  requireExactUrl(source, 'MOMO_API_BASE_URL', new URL('/', paymentDemoOrigin));
  requireExactUrl(source, 'VNPAY_API_BASE_URL', new URL('/vnpay-test/pay', paymentDemoOrigin));
  requireExactUrl(
    source,
    'MOMO_RETURN_URL',
    new URL('/api/v1/payments/providers/momo/return', webOrigin),
  );
  requireExactUrl(source, 'MOMO_IPN_URL', new URL('/api/v1/webhooks/momo', webOrigin));
  requireExactUrl(
    source,
    'VNPAY_RETURN_URL',
    new URL('/api/v1/payments/providers/vnpay/return', webOrigin),
  );
  requireExactUrl(source, 'VNPAY_IPN_URL', new URL('/api/v1/webhooks/vnpay', webOrigin));
}

export function validateProductionDeploymentEnvironment(source: EnvironmentSource): void {
  requireParsed('API', parseApiEnvironment(source));
  requireParsed('Web', parseWebEnvironment(source));
  requireParsed('Worker', parseWorkerEnvironment(source));

  if (source.PAYMENT_DEMO_ENABLED !== 'true') return;

  try {
    loadEnvironment(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid payment-demo environment';
    // loadEnvironment errors identify only configuration keys and constraints.
    throw new Error(`payment-demo environment rejected: ${message}`);
  }

  validateProviderUrlAuthority(source);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    validateProductionDeploymentEnvironment(process.env);
    process.stdout.write('Production deployment environment contract passed.\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid environment contract';
    process.stderr.write(`Production deployment environment contract failed: ${message}\n`);
    process.exitCode = 1;
  }
}
