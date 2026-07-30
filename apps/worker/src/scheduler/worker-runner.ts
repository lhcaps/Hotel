import {
  WorkerScheduler,
  type WorkerSchedulerEvent,
  type WorkerSchedulerEventRecorder,
  type WorkerSchedulerLogger,
} from './worker-scheduler.js';

export interface WorkerJob {
  readonly name: 'HOLD_EXPIRATION' | 'OUTBOX_DELIVERY' | 'PAYMENT_RECONCILIATION';
  readonly run: () => Promise<unknown>;
}

export interface RunWorkerOnceOptions {
  readonly expirationJob: WorkerJob;
  readonly outboxJob: WorkerJob;
  readonly reconciliationJob?: WorkerJob;
  readonly logger?: WorkerSchedulerLogger;
}

export interface RunWorkerOnceSummary {
  readonly expiration: 'succeeded' | 'failed' | 'skipped';
  readonly outbox: 'succeeded' | 'failed' | 'skipped';
  readonly expirationError: unknown;
  readonly outboxError: unknown;
}

export async function runWorkerOnce(options: RunWorkerOnceOptions): Promise<RunWorkerOnceSummary> {
  const logger = options.logger ?? silentLogger();

  const expirationResult = await safeRun(options.expirationJob, logger);
  const outboxResult = await safeRun(options.outboxJob, logger);
  if (options.reconciliationJob !== undefined) {
    await safeRun(options.reconciliationJob, logger);
  }

  return {
    expiration: expirationResult.status,
    outbox: outboxResult.status,
    expirationError: expirationResult.error,
    outboxError: outboxResult.error,
  };
}

export interface RunWorkerContinuouslyOptions {
  readonly expirationJob: WorkerJob;
  readonly outboxJob: WorkerJob;
  readonly expirationIntervalMs: number;
  readonly outboxIntervalMs: number;
  readonly reconciliationIntervalMs?: number;
  readonly reconciliationJob?: WorkerJob;
  readonly initialBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly signal?: AbortSignal;
  readonly logger?: WorkerSchedulerLogger;
  readonly now?: () => number;
  readonly wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly eventRecorder?: WorkerSchedulerEventRecorder;
}

export async function runWorkerContinuously(
  options: RunWorkerContinuouslyOptions,
): Promise<{ completed: boolean; iterations: number; shutdownRequested: boolean }> {
  const scheduler = new WorkerScheduler({
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.wait !== undefined ? { wait: options.wait } : {}),
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
    ...(options.eventRecorder !== undefined ? { eventRecorder: options.eventRecorder } : {}),
    expiration: {
      name: 'HOLD_EXPIRATION',
      intervalMs: options.expirationIntervalMs,
      run: options.expirationJob.run,
    },
    outbox: {
      name: 'OUTBOX_DELIVERY',
      intervalMs: options.outboxIntervalMs,
      run: options.outboxJob.run,
    },
    reconciliation: options.reconciliationJob === undefined
      ? {
          name: 'PAYMENT_RECONCILIATION',
          intervalMs: options.reconciliationIntervalMs ?? 3_600_000,
          run: async () => undefined,
        }
      : {
          name: 'PAYMENT_RECONCILIATION',
          intervalMs: options.reconciliationIntervalMs ?? 30_000,
          run: options.reconciliationJob.run,
        },
    initialBackoffMs: options.initialBackoffMs,
    maxBackoffMs: options.maxBackoffMs,
  });

  if (options.signal !== undefined) {
    if (options.signal.aborted) {
      scheduler.requestShutdown();
    } else {
      options.signal.addEventListener(
        'abort',
        () => {
          scheduler.requestShutdown();
        },
        { once: true },
      );
    }
  }

  const summary = await scheduler.run();
  return {
    completed: summary.completed,
    iterations: summary.iterations,
    shutdownRequested: summary.shutdownRequested,
  };
}

async function safeRun(
  job: WorkerJob,
  logger: WorkerSchedulerLogger,
): Promise<{ status: 'succeeded' | 'failed'; error: unknown }> {
  try {
    await job.run();
    return { status: 'succeeded', error: undefined };
  } catch (error) {
    logger.warn({ job: job.name }, 'worker.job.failed');
    return { status: 'failed', error };
  }
}

function silentLogger(): WorkerSchedulerLogger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

export type { WorkerSchedulerEvent, WorkerSchedulerEventRecorder };
