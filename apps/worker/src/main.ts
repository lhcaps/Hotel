import { Buffer } from 'node:buffer';
import { requireWorkerEnvironment } from '@room/config';
import { createDatabasePool } from '@room/database';
import { createLogger } from '@room/observability';
import nodemailer from 'nodemailer';
import { Redis } from 'ioredis';

import { expireStaleHolds } from './jobs/expire-stale-holds.js';
import { processOutbox } from './jobs/process-outbox.js';
import { createReconciliationJob } from './jobs/process-reconciliation.js';
import { createUnavailableReconciliationQueryProvider } from './reconciliation/query-provider.js';
import { createSMTPTransport } from './email/smtp-transport.js';
import { WorkerLifecycle } from './lifecycle.js';
import { runWorkerContinuously, runWorkerOnce } from './scheduler/worker-runner.js';
import { requireWorkerOperationalConfig, type WorkerMode } from './worker-config.js';

let logger = createLogger({ service: 'worker', environment: 'unknown' });

async function bootstrap(): Promise<number> {
  const environment = requireWorkerEnvironment();
  const operationalConfig = requireWorkerOperationalConfig();
  logger = createLogger({
    service: 'worker',
    environment: environment.NODE_ENV,
    level: environment.LOG_LEVEL,
  });
  logger.info({ mode: operationalConfig.WORKER_MODE }, 'worker.mode.selected');

  const pool = createDatabasePool(environment.DATABASE_URL, {
    applicationName: 'room-management-worker',
    max: 5,
  });
  const redis = new Redis(environment.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on('error', () => undefined);
  await redis.connect();
  const transport = createSMTPTransport(
    {
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      secure: environment.SMTP_SECURE,
      ...(environment.SMTP_USER === undefined ? {} : { user: environment.SMTP_USER }),
      ...(environment.SMTP_PASSWORD === undefined ? {} : { password: environment.SMTP_PASSWORD }),
      requireAuth: environment.SMTP_USER !== undefined || environment.SMTP_PASSWORD !== undefined,
    },
    nodemailer,
  );

  let closed = false;
  const lifecycle = new WorkerLifecycle({
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await transport.close().catch(() => undefined);
      await Promise.all([pool.end(), redis.quit()]);
    },
  });

  const expirationJob = {
    name: 'HOLD_EXPIRATION' as const,
    run: () => expireStaleHolds({ pool, batchSize: 50, maxBatches: 4 }),
  };
  const outboxJob = {
    name: 'OUTBOX_DELIVERY' as const,
    run: () =>
      processOutbox(
        {
          pool,
          transport,
          fromAddress: environment.SMTP_FROM,
          batchSize: 25,
          leaseTtlMs: 30_000,
          baseBackoffMs: 1_000,
          maxBackoffMs: 5 * 60_000,
          otpSecret: Buffer.from(environment.GUEST_OTP_SECRET, 'utf8'),
        },
        logger,
      ),
  };

  const reconciliationJob = createReconciliationJob({
    pool,
    queryProvider: createUnavailableReconciliationQueryProvider(),
    batchSize: operationalConfig.WORKER_RECONCILIATION_BATCH_SIZE,
    leaseTtlMs: operationalConfig.WORKER_RECONCILIATION_LEASE_TTL_MS,
    concurrency: operationalConfig.WORKER_RECONCILIATION_CONCURRENCY,
    maxAttempts: operationalConfig.WORKER_RECONCILIATION_MAX_ATTEMPTS,
    leaseOwner: `worker:${process.pid}`,
    queryTimeoutMs: 30_000,
  });
  process.once('SIGINT', () => {
    lifecycle.shutdown('SIGINT').catch(() => undefined);
  });
  process.once('SIGTERM', () => {
    lifecycle.shutdown('SIGTERM').catch(() => undefined);
  });

  if (operationalConfig.WORKER_MODE === 'continuous') {
    return runContinuous(
      lifecycle,
      operationalConfig.WORKER_MODE,
      expirationJob,
      outboxJob,
      reconciliationJob,
    );
  }
  return runOnce(
    lifecycle,
    operationalConfig.WORKER_MODE,
    expirationJob,
    outboxJob,
    reconciliationJob,
  );
}

async function runContinuous(
  lifecycle: WorkerLifecycle,
  mode: WorkerMode,
  expirationJob: { name: 'HOLD_EXPIRATION'; run: () => Promise<unknown> },
  outboxJob: { name: 'OUTBOX_DELIVERY'; run: () => Promise<unknown> },
  reconciliationJob: { name: 'PAYMENT_RECONCILIATION'; run: () => Promise<unknown> },
): Promise<number> {
  const config = requireWorkerOperationalConfig();
  logger.info({ mode }, 'worker.started');
  const summary = await lifecycle.runIteration(() =>
    runWorkerContinuously({
      expirationJob,
      outboxJob,
      reconciliationJob,
      expirationIntervalMs: config.WORKER_EXPIRATION_INTERVAL_MS,
      outboxIntervalMs: config.WORKER_OUTBOX_INTERVAL_MS,
      reconciliationIntervalMs: config.WORKER_RECONCILIATION_INTERVAL_MS,
      initialBackoffMs: config.WORKER_ERROR_BACKOFF_MS,
      maxBackoffMs: config.WORKER_MAX_ERROR_BACKOFF_MS,
      logger,
    }),
  );
  logger.info({ iterations: summary.iterations }, 'worker.shutdown.completed');
  await lifecycle.shutdown('SIGTERM');
  return 0;
}

async function runOnce(
  lifecycle: WorkerLifecycle,
  mode: WorkerMode,
  expirationJob: { name: 'HOLD_EXPIRATION'; run: () => Promise<unknown> },
  outboxJob: { name: 'OUTBOX_DELIVERY'; run: () => Promise<unknown> },
  reconciliationJob: { name: 'PAYMENT_RECONCILIATION'; run: () => Promise<unknown> },
): Promise<number> {
  logger.info({ mode }, 'worker.started');
  const summary = await lifecycle.runIteration(() =>
    runWorkerOnce({ expirationJob, outboxJob, reconciliationJob, logger }),
  );
  logger.info({ ...summaryToFields(summary) }, 'worker.shutdown.completed');
  await lifecycle.shutdown('SIGTERM');
  return summary.expiration === 'failed' || summary.outbox === 'failed' ? 1 : 0;
}

function summaryToFields(summary: {
  expiration: 'succeeded' | 'failed' | 'skipped';
  outbox: 'succeeded' | 'failed' | 'skipped';
}): { expiration: string; outbox: string } {
  return { expiration: summary.expiration, outbox: summary.outbox };
}

void bootstrap()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Worker startup failed');
    process.exit(1);
  });
