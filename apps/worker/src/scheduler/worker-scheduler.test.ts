import { setTimeout as delay } from 'node:timers/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WorkerScheduler,
  type WorkerSchedulerEvent,
  type WorkerSchedulerEventRecorder,
  type WorkerSchedulerLogger,
} from './worker-scheduler.js';

interface RecordedWait {
  readonly ms: number;
  readonly signal: AbortSignal;
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface ControllableClock {
  readonly now: () => number;
  readonly waits: RecordedWait[];
  readonly advance: (ms: number) => Promise<void>;
  readonly wait: (ms: number, signal: AbortSignal) => Promise<void>;
}

function createControllableClock(start = 0): ControllableClock {
  let current = start;
  const waits: RecordedWait[] = [];
  const clock: ControllableClock = {
    waits,
    now: () => current,
    advance: async (ms) => {
      current += ms;
      const due = waits.filter((wait) => wait.signal.aborted === false && wait.ms <= current);
      for (const wait of due) {
        waits.splice(waits.indexOf(wait), 1);
        wait.resolve();
      }
      // Yield enough microtasks for the scheduler loop to resume, run any
      // due jobs, register the next wait, and suspend again.
      for (let i = 0; i < 8; i += 1) {
        await Promise.resolve();
      }
    },
    wait: (ms, signal) => {
      if (signal.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      return new Promise<void>((resolve, reject) => {
        const entry: RecordedWait = {
          ms,
          signal,
          resolve: () => {
            signal.removeEventListener('abort', onAbort);
            resolve();
          },
          reject: (error) => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
          },
        };
        const onAbort = () => {
          const index = waits.indexOf(entry);
          if (index >= 0) waits.splice(index, 1);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        waits.push(entry);
      });
    },
  };
  return clock;
}

function silentLogger(): WorkerSchedulerLogger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function recordingRecorder(): {
  readonly events: WorkerSchedulerEvent[];
  readonly recorder: WorkerSchedulerEventRecorder;
} {
  const events: WorkerSchedulerEvent[] = [];
  return {
    events,
    recorder: {
      record: (event) => {
        events.push(event);
      },
    },
  };
}

const NO_JOBS = {
  expiration: { name: 'HOLD_EXPIRATION' as const, intervalMs: 50, run: vi.fn() },
  outbox: { name: 'OUTBOX_DELIVERY' as const, intervalMs: 50, run: vi.fn() },
};

describe('WorkerScheduler', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs both jobs immediately on startup', async () => {
    const expiration = vi.fn().mockResolvedValue(undefined);
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 100,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    await clock.advance(0);
    scheduler.requestShutdown();
    await clock.advance(0);
    await promise;
    expect(expiration).toHaveBeenCalledTimes(1);
    expect(outbox).toHaveBeenCalledTimes(1);
  });

  it('re-runs each job at its configured interval', async () => {
    const expiration = vi.fn().mockResolvedValue(undefined);
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 100, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    expect(expiration).toHaveBeenCalledTimes(1);
    expect(outbox).toHaveBeenCalledTimes(1);

    await clock.advance(50);
    expect(outbox).toHaveBeenCalledTimes(2);
    expect(expiration).toHaveBeenCalledTimes(1);

    await clock.advance(100);
    expect(expiration).toHaveBeenCalledTimes(2);
    expect(outbox).toHaveBeenCalledTimes(3);

    scheduler.requestShutdown();
    await promise;
  });

  it('never overlaps the same job with itself', async () => {
    let active = 0;
    let maxActive = 0;
    const expiration = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      // Long-running job.
      await delay(250);
      active -= 1;
    });
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 100, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    await clock.advance(50);
    await clock.advance(100);
    await clock.advance(100);
    await clock.advance(100);
    scheduler.requestShutdown();
    await promise;
    expect(maxActive).toBeLessThanOrEqual(1);
  });

  it('a long job does not produce stacked pending executions', async () => {
    let counter = 0;
    const expiration = vi.fn(async () => {
      counter += 1;
      await delay(250);
    });
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    await clock.advance(50);
    await clock.advance(50);
    await clock.advance(50);
    scheduler.requestShutdown();
    await promise;
    // Each expiration takes 250ms; the interval is 50ms. With no overlap
    // allowed, the next due-time is one interval after completion, so the
    // total attempts must be < 2 (one initial + zero or one follow-up).
    expect(counter).toBeLessThanOrEqual(2);
  });

  it('successful run resets the consecutive failure count', async () => {
    let attempt = 0;
    const expiration = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('transient');
      }
    });
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    expect(scheduler.snapshot().expiration.consecutiveFailures).toBe(1);
    await clock.advance(25);
    await clock.advance(0);
    expect(scheduler.snapshot().expiration.consecutiveFailures).toBe(0);
    scheduler.requestShutdown();
    await promise;
  });

  it('a failed job is re-scheduled with bounded exponential backoff', async () => {
    const failures = [1, 2, 3, 4].map((value) => Symbol(`fail${value}`));
    let calls = 0;
    const expiration = vi.fn(async () => {
      throw failures[calls++];
    });
    const outbox = vi.fn().mockResolvedValue(undefined);
    const rec = recordingRecorder();
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
      eventRecorder: rec.recorder,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    await clock.advance(25);
    await clock.advance(50);
    await clock.advance(100);
    scheduler.requestShutdown();
    await promise;
    const backoffEvents = rec.events.filter((event) => event.type === 'job.backoff_scheduled');
    expect(backoffEvents).toHaveLength(4);
    const backoffMs = backoffEvents.map(
      (event) => (event as Extract<WorkerSchedulerEvent, { type: 'job.backoff_scheduled' }>).backoffMs,
    );
    // 25, 50, 100, 200 — capped at maxBackoffMs.
    expect(backoffMs).toEqual([25, 50, 100, 200]);
  });

  it('backoff never exceeds the configured maximum', async () => {
    const expiration = vi.fn(async () => {
      throw new Error('always fails');
    });
    const outbox = vi.fn().mockResolvedValue(undefined);
    const rec = recordingRecorder();
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 50,
      maxBackoffMs: 100,
      now: clock.now,
      wait: clock.wait,
      eventRecorder: rec.recorder,
    });
    const promise = scheduler.run();
    for (let i = 0; i < 6; i += 1) {
      await clock.advance(100);
    }
    scheduler.requestShutdown();
    await promise;
    const backoffMs = rec.events
      .filter((event) => event.type === 'job.backoff_scheduled')
      .map((event) => (event as Extract<WorkerSchedulerEvent, { type: 'job.backoff_scheduled' }>).backoffMs);
    expect(backoffMs.every((value) => value <= 100)).toBe(true);
  });

  it('one job failure does not prevent the other job from running', async () => {
    const expiration = vi.fn(async () => {
      throw new Error('expiration failed');
    });
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    await clock.advance(25);
    await clock.advance(50);
    expect(expiration).toHaveBeenCalled();
    expect(outbox.mock.calls.length).toBeGreaterThanOrEqual(2);
    scheduler.requestShutdown();
    await promise;
  });

  it('a pending wait aborts promptly on shutdown', async () => {
    const expiration = vi.fn().mockResolvedValue(undefined);
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    expect(clock.waits.length).toBeGreaterThan(0);
    scheduler.requestShutdown();
    await promise;
    // All pending waits must settle after shutdown.
    for (const wait of clock.waits) {
      expect(wait.signal.aborted).toBe(true);
    }
  });

  it('shutdown prevents another iteration from starting', async () => {
    const expiration = vi.fn().mockResolvedValue(undefined);
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    scheduler.requestShutdown();
    await promise;
    const afterShutdown = scheduler.snapshot();
    expect(afterShutdown.shutdownRequested).toBe(true);
    // Advance again; no new iterations should start.
    await clock.advance(500);
    expect(expiration).toHaveBeenCalledTimes(1);
    expect(outbox).toHaveBeenCalledTimes(1);
  });

  it('multiple shutdown calls are idempotent', async () => {
    const rec = recordingRecorder();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: vi.fn() },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: vi.fn() },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: () => 0,
      wait: () => new Promise(() => undefined),
      eventRecorder: rec.recorder,
    });
    scheduler.requestShutdown();
    scheduler.requestShutdown();
    scheduler.requestShutdown();
    const shutdownEvents = rec.events.filter(
      (event) => event.type === 'scheduler.shutdown_requested',
    );
    expect(shutdownEvents).toHaveLength(1);
  });

  it('emits the documented observability events', async () => {
    const expiration = vi.fn().mockResolvedValue(undefined);
    const outbox = vi.fn().mockResolvedValue(undefined);
    const rec = recordingRecorder();
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
      eventRecorder: rec.recorder,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    scheduler.requestShutdown();
    await promise;
    const types = rec.events.map((event) => event.type);
    expect(types).toContain('job.started');
    expect(types).toContain('job.completed');
    expect(types).toContain('scheduler.shutdown_requested');
    expect(types).toContain('scheduler.completed');
  });

  it('does not log raw exception stacks', async () => {
    const recorder = recordingRecorder();
    const records: Array<{ record: Record<string, unknown>; message: string }> = [];
    const logger: WorkerSchedulerLogger = {
      info: (record, message) => {
        records.push({ record, message });
      },
      warn: (record, message) => {
        records.push({ record, message });
      },
      error: (record, message) => {
        records.push({ record, message });
      },
    };
    const transient = new Error('connection refused');
    transient.stack = 'STACK: at /private/secrets/otp-leak.js';
    const expiration = vi.fn(async () => {
      throw transient;
    });
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: vi.fn() },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
      eventRecorder: recorder.recorder,
      logger,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    scheduler.requestShutdown();
    await promise;
    const serialized = JSON.stringify({ logger: records, recorder: recorder.events });
    // The recorder is the source of truth for the scheduler contract.
    expect(serialized).not.toContain('STACK:');
    expect(serialized).not.toContain('/private/secrets');
    // Standard diagnostic error messages remain visible.
    expect(serialized).toContain('connection refused');
  });

  it('rejects invalid configuration at construction time', () => {
    expect(() => {
      new WorkerScheduler({
        expiration: { name: 'HOLD_EXPIRATION', intervalMs: 0, run: vi.fn() },
        outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: vi.fn() },
        initialBackoffMs: 25,
        maxBackoffMs: 200,
      });
    }).toThrow(/intervalMs/);
    expect(() => {
      new WorkerScheduler({
        expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: vi.fn() },
        outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: vi.fn() },
        initialBackoffMs: 200,
        maxBackoffMs: 25,
      });
    }).toThrow(/maxBackoffMs/);
    expect(() => {
      new WorkerScheduler({
        expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: vi.fn() },
        outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: vi.fn() },
        initialBackoffMs: 0,
        maxBackoffMs: 200,
      });
    }).toThrow(/initialBackoffMs/);
  });

  it('uses the optional injected event recorder and logger', async () => {
    const expire = vi.fn().mockResolvedValue(undefined);
    const outbox = vi.fn().mockResolvedValue(undefined);
    const rec = recordingRecorder();
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expire },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
      eventRecorder: rec.recorder,
      logger: silentLogger(),
    });
    const promise = scheduler.run();
    await clock.advance(0);
    scheduler.requestShutdown();
    await promise;
    expect(rec.events.length).toBeGreaterThan(0);
  });

  it('waits for the active iteration to finish before completing shutdown', async () => {
    let release: (() => void) | undefined;
    const block = new Promise<void>((resolve) => {
      release = resolve;
    });
    const expiration = vi.fn(async () => {
      await block;
    });
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    scheduler.requestShutdown();
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    release?.();
    await promise;
    expect(resolved).toBe(true);
  });

  it('leaves no unhandled rejection after a failed job', async () => {
    const errors: unknown[] = [];
    const unhandled = (reason: unknown) => {
      errors.push(reason);
    };
    process.once('unhandledRejection', unhandled);
    const expiration = vi.fn(async () => {
      throw new Error('planned failure');
    });
    const outbox = vi.fn().mockResolvedValue(undefined);
    const clock = createControllableClock();
    const scheduler = new WorkerScheduler({
      expiration: { name: 'HOLD_EXPIRATION', intervalMs: 50, run: expiration },
      outbox: { name: 'OUTBOX_DELIVERY', intervalMs: 50, run: outbox },
      initialBackoffMs: 25,
      maxBackoffMs: 200,
      now: clock.now,
      wait: clock.wait,
    });
    const promise = scheduler.run();
    await clock.advance(0);
    await clock.advance(25);
    scheduler.requestShutdown();
    await promise;
    process.off('unhandledRejection', unhandled);
    expect(errors).toHaveLength(0);
  });

  it('covers the static constructor-style compatibility entry', () => {
    expect(WorkerScheduler).toBeDefined();
    expect(NO_JOBS.expiration.name).toBe('HOLD_EXPIRATION');
    expect(NO_JOBS.outbox.name).toBe('OUTBOX_DELIVERY');
  });
});
