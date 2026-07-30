import { setTimeout as scheduleTimeout } from 'node:timers/promises';

export type WorkerSchedulerJobName =
  'HOLD_EXPIRATION' | 'OUTBOX_DELIVERY' | 'PAYMENT_RECONCILIATION';

export interface WorkerSchedulerJobOptions {
  readonly name: WorkerSchedulerJobName;
  readonly intervalMs: number;
  readonly run: () => Promise<unknown>;
}

export interface WorkerSchedulerOptions {
  readonly expiration: WorkerSchedulerJobOptions;
  readonly outbox: WorkerSchedulerJobOptions;
  readonly reconciliation?: WorkerSchedulerJobOptions;
  readonly initialBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly now?: () => number;
  readonly wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly logger?: WorkerSchedulerLogger;
  readonly eventRecorder?: WorkerSchedulerEventRecorder;
}

export interface WorkerSchedulerLogger {
  info: (record: Record<string, unknown>, message: string) => void;
  warn: (record: Record<string, unknown>, message: string) => void;
  error: (record: Record<string, unknown>, message: string) => void;
}

export type WorkerSchedulerEvent =
  | { type: 'job.started'; job: WorkerSchedulerJobName; attempt: number }
  | {
      type: 'job.completed';
      job: WorkerSchedulerJobName;
      attempt: number;
      durationMs: number;
    }
  | {
      type: 'job.failed';
      job: WorkerSchedulerJobName;
      attempt: number;
      category: string;
      durationMs: number;
      message: string;
    }
  | {
      type: 'job.backoff_scheduled';
      job: WorkerSchedulerJobName;
      attempt: number;
      backoffMs: number;
    }
  | { type: 'scheduler.shutdown_requested' }
  | { type: 'scheduler.completed' };

export interface WorkerSchedulerEventRecorder {
  record: (event: WorkerSchedulerEvent) => void;
}

export interface WorkerSchedulerSnapshot {
  readonly expiration: {
    readonly nextDueAt: number;
    readonly consecutiveFailures: number;
    readonly inFlight: boolean;
    readonly totalAttempts: number;
  };
  readonly outbox: {
    readonly nextDueAt: number;
    readonly consecutiveFailures: number;
    readonly inFlight: boolean;
    readonly totalAttempts: number;
  };
  readonly reconciliation: {
    readonly nextDueAt: number;
    readonly consecutiveFailures: number;
    readonly inFlight: boolean;
    readonly totalAttempts: number;
  };
  readonly shutdownRequested: boolean;
}

export interface WorkerSchedulerRunSummary {
  readonly completed: boolean;
  readonly iterations: number;
  readonly shutdownRequested: boolean;
}

const BACKOFF_CEILING = 32;

function safeErrorCategory(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
    const name = error.name;
    if (typeof name === 'string' && name.length > 0) {
      return name;
    }
  }
  return 'WORKER_JOB_ERROR';
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown worker job error';
}

interface JobState {
  readonly options: WorkerSchedulerJobOptions;
  nextDueAt: number;
  consecutiveFailures: number;
  inFlight: boolean;
  totalAttempts: number;
}

export class WorkerScheduler {
  private readonly jobs: { expiration: JobState; outbox: JobState; reconciliation: JobState };
  private readonly now: () => number;
  private readonly wait: (ms: number, signal: AbortSignal) => Promise<void>;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly eventRecorder: WorkerSchedulerEventRecorder;
  private readonly shutdownController = new AbortController();
  private shutdownRequested = false;
  private iterations = 0;

  public constructor(options: WorkerSchedulerOptions) {
    const startAt = options.now ? options.now() : Date.now();
    const expirationIntervalMs = validatePositive(
      options.expiration.intervalMs,
      'expiration.intervalMs',
    );
    const outboxIntervalMs = validatePositive(options.outbox.intervalMs, 'outbox.intervalMs');
    const reconciliation = options.reconciliation ?? {
      name: 'PAYMENT_RECONCILIATION' as const,
      intervalMs: 3_600_000,
      run: async () => undefined,
    };
    const reconciliationIntervalMs = validatePositive(
      reconciliation.intervalMs,
      'reconciliation.intervalMs',
    );
    const initialBackoffMs = validatePositive(options.initialBackoffMs, 'initialBackoffMs');
    const maxBackoffMs = validatePositive(options.maxBackoffMs, 'maxBackoffMs');
    if (maxBackoffMs < initialBackoffMs) {
      throw new RangeError('maxBackoffMs must be >= initialBackoffMs');
    }
    this.initialBackoffMs = initialBackoffMs;
    this.maxBackoffMs = maxBackoffMs;
    this.now = options.now ?? Date.now;
    this.wait = options.wait ?? defaultWait;
    this.eventRecorder = options.eventRecorder ?? defaultEventRecorder(options.logger);
    this.jobs = {
      expiration: {
        options: { ...options.expiration, intervalMs: expirationIntervalMs },
        nextDueAt: startAt,
        consecutiveFailures: 0,
        inFlight: false,
        totalAttempts: 0,
      },
      outbox: {
        options: { ...options.outbox, intervalMs: outboxIntervalMs },
        nextDueAt: startAt,
        consecutiveFailures: 0,
        inFlight: false,
        totalAttempts: 0,
      },
      reconciliation: {
        options: { ...reconciliation, intervalMs: reconciliationIntervalMs },
        nextDueAt: startAt,
        consecutiveFailures: 0,
        inFlight: false,
        totalAttempts: 0,
      },
    };
  }

  public requestShutdown(): void {
    if (this.shutdownRequested) {
      return;
    }
    this.shutdownRequested = true;
    this.shutdownController.abort();
    this.eventRecorder.record({ type: 'scheduler.shutdown_requested' });
  }

  public isShutdownRequested(): boolean {
    return this.shutdownRequested;
  }

  public async run(): Promise<WorkerSchedulerRunSummary> {
    while (!this.shutdownRequested) {
      const now = this.now();
      const dueJobs = this.dueJobs(now);
      if (dueJobs.length === 0) {
        await this.sleepUntilNextDueOrShutdown();
        continue;
      }
      for (const job of dueJobs) {
        if (this.shutdownRequested) {
          break;
        }
        await this.executeJob(job);
      }
    }
    this.eventRecorder.record({ type: 'scheduler.completed' });
    return {
      completed: true,
      iterations: this.iterations,
      shutdownRequested: this.shutdownRequested,
    };
  }

  public snapshot(): WorkerSchedulerSnapshot {
    return {
      expiration: { ...this.jobs.expiration },
      outbox: { ...this.jobs.outbox },
      reconciliation: { ...this.jobs.reconciliation },
      shutdownRequested: this.shutdownRequested,
    };
  }

  private dueJobs(now: number): JobState[] {
    const result: JobState[] = [];
    for (const job of Object.values(this.jobs)) {
      if (job.inFlight) continue;
      if (job.nextDueAt <= now) {
        result.push(job);
      }
    }
    return result;
  }

  private async sleepUntilNextDueOrShutdown(): Promise<void> {
    const now = this.now();
    const nextDue = Math.min(
      this.jobs.expiration.nextDueAt,
      this.jobs.outbox.nextDueAt,
      this.jobs.reconciliation.nextDueAt,
    );
    const delay = Math.max(0, nextDue - now);
    if (delay === 0) {
      return;
    }
    try {
      await this.wait(delay, this.shutdownController.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      throw error;
    }
  }

  private async executeJob(job: JobState): Promise<void> {
    if (job.inFlight) {
      return;
    }
    job.inFlight = true;
    job.totalAttempts += 1;
    const attempt = job.totalAttempts;
    this.iterations += 1;
    const start = this.now();
    this.eventRecorder.record({ type: 'job.started', job: job.options.name, attempt });
    try {
      await job.options.run();
      const durationMs = this.now() - start;
      job.consecutiveFailures = 0;
      job.nextDueAt = this.now() + job.options.intervalMs;
      this.eventRecorder.record({
        type: 'job.completed',
        job: job.options.name,
        attempt,
        durationMs,
      });
    } catch (error) {
      const durationMs = this.now() - start;
      const category = safeErrorCategory(error);
      const message = safeErrorMessage(error);
      job.consecutiveFailures += 1;
      const backoffMs = this.computeBackoff(job.consecutiveFailures);
      job.nextDueAt = this.now() + backoffMs;
      this.eventRecorder.record({
        type: 'job.failed',
        job: job.options.name,
        attempt,
        category,
        durationMs,
        message,
      });
      this.eventRecorder.record({
        type: 'job.backoff_scheduled',
        job: job.options.name,
        attempt,
        backoffMs,
      });
    } finally {
      job.inFlight = false;
    }
  }

  private computeBackoff(consecutiveFailures: number): number {
    if (consecutiveFailures <= 1) {
      return this.initialBackoffMs;
    }
    const exponent = Math.min(consecutiveFailures - 1, BACKOFF_CEILING);
    const candidate = this.initialBackoffMs * 2 ** exponent;
    return Math.min(candidate, this.maxBackoffMs);
  }
}

function validatePositive(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive integer`);
  }
  return value;
}

async function defaultWait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  await scheduleTimeout(ms, undefined, { signal });
}

function defaultEventRecorder(logger?: WorkerSchedulerLogger): WorkerSchedulerEventRecorder {
  const sink = logger ?? silentLogger();
  return {
    record: (event) => {
      switch (event.type) {
        case 'job.started':
          sink.info({ event: event.type, job: event.job, attempt: event.attempt }, event.type);
          return;
        case 'job.completed':
          sink.info(
            {
              event: event.type,
              job: event.job,
              attempt: event.attempt,
              durationMs: event.durationMs,
            },
            event.type,
          );
          return;
        case 'job.failed':
          sink.warn(
            {
              event: event.type,
              job: event.job,
              attempt: event.attempt,
              category: event.category,
              durationMs: event.durationMs,
            },
            event.type,
          );
          return;
        case 'job.backoff_scheduled':
          sink.info(
            {
              event: event.type,
              job: event.job,
              attempt: event.attempt,
              backoffMs: event.backoffMs,
            },
            event.type,
          );
          return;
        case 'scheduler.shutdown_requested':
          sink.info({ event: event.type }, event.type);
          return;
        case 'scheduler.completed':
          sink.info({ event: event.type }, event.type);
          return;
      }
    },
  };
}

function silentLogger(): WorkerSchedulerLogger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}
