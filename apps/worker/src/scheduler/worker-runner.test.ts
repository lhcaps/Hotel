import { setTimeout as waitTimer } from 'node:timers/promises';

import { describe, expect, it, vi } from 'vitest';

import { runWorkerContinuously, runWorkerOnce } from './worker-runner.js';

describe('runWorkerOnce', () => {
  it('runs expiration then outbox exactly once and returns the summary', async () => {
    const order: string[] = [];
    const expirationJob = {
      name: 'HOLD_EXPIRATION' as const,
      run: vi.fn(async () => {
        order.push('expiration');
      }),
    };
    const outboxJob = {
      name: 'OUTBOX_DELIVERY' as const,
      run: vi.fn(async () => {
        order.push('outbox');
      }),
    };
    const summary = await runWorkerOnce({ expirationJob, outboxJob });
    expect(order).toEqual(['expiration', 'outbox']);
    expect(summary.expiration).toBe('succeeded');
    expect(summary.outbox).toBe('succeeded');
    expect(expirationJob.run).toHaveBeenCalledTimes(1);
    expect(outboxJob.run).toHaveBeenCalledTimes(1);
  });

  it('still attempts outbox after expiration failure (Phase 5 cascade)', async () => {
    const expirationJob = {
      name: 'HOLD_EXPIRATION' as const,
      run: vi.fn(async () => {
        throw new Error('expiration failure');
      }),
    };
    const outboxJob = {
      name: 'OUTBOX_DELIVERY' as const,
      run: vi.fn(async () => undefined),
    };
    const summary = await runWorkerOnce({ expirationJob, outboxJob });
    expect(summary.expiration).toBe('failed');
    expect(summary.outbox).toBe('succeeded');
    expect(outboxJob.run).toHaveBeenCalledTimes(1);
  });

  it('runs housekeeping reminders in the one-shot lifecycle', async () => {
    const remindersJob = {
      name: 'HOUSEKEEPING_REMINDERS' as const,
      run: vi.fn(async () => undefined),
    };
    const summary = await runWorkerOnce({
      expirationJob: { name: 'HOLD_EXPIRATION', run: vi.fn(async () => undefined) },
      outboxJob: { name: 'OUTBOX_DELIVERY', run: vi.fn(async () => undefined) },
      remindersJob,
    });
    expect(remindersJob.run).toHaveBeenCalledTimes(1);
    expect(summary.reminders).toBe('succeeded');
  });
});

describe('runWorkerContinuously', () => {
  it('runs both jobs at least once and stops on signal', async () => {
    const expiration = vi.fn().mockResolvedValue(undefined);
    const outbox = vi.fn().mockResolvedValue(undefined);
    const controller = new AbortController();
    const summaryPromise = runWorkerContinuously({
      expirationJob: { name: 'HOLD_EXPIRATION', run: expiration },
      outboxJob: { name: 'OUTBOX_DELIVERY', run: outbox },
      expirationIntervalMs: 25,
      outboxIntervalMs: 25,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
      signal: controller.signal,
      now: () => 0,
      wait: (_ms, signal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    });
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    const summary = await summaryPromise;
    expect(summary.shutdownRequested).toBe(true);
    expect(expiration).toHaveBeenCalled();
    expect(outbox).toHaveBeenCalled();
  });

  it('exits when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const summary = await runWorkerContinuously({
      expirationJob: { name: 'HOLD_EXPIRATION', run: vi.fn() },
      outboxJob: { name: 'OUTBOX_DELIVERY', run: vi.fn() },
      expirationIntervalMs: 25,
      outboxIntervalMs: 25,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
      signal: controller.signal,
      now: () => 0,
      wait: () => new Promise(() => undefined),
    });
    expect(summary.shutdownRequested).toBe(true);
    expect(summary.completed).toBe(true);
  });

  it('runs both jobs once before shutdown when wait resolves immediately', async () => {
    const expiration = vi.fn().mockResolvedValue(undefined);
    const outbox = vi.fn().mockResolvedValue(undefined);
    const controller = new AbortController();
    let shouldResolve = true;
    const promise = runWorkerContinuously({
      expirationJob: { name: 'HOLD_EXPIRATION', run: expiration },
      outboxJob: { name: 'OUTBOX_DELIVERY', run: outbox },
      expirationIntervalMs: 25,
      outboxIntervalMs: 25,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
      signal: controller.signal,
      now: () => 0,
      wait: (_ms, signal) =>
        new Promise<void>((resolve, reject) => {
          if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
          signal.addEventListener('abort', onAbort, { once: true });
          if (shouldResolve) {
            shouldResolve = false;
            void waitTimer(0).then(() => {
              signal.removeEventListener('abort', onAbort);
              resolve();
            });
          }
        }),
    });
    // Yield enough microtasks for both jobs to execute and the scheduler to
    // settle into its (now-blocked) second sleep.
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
    expect(expiration).toHaveBeenCalledTimes(1);
    expect(outbox).toHaveBeenCalledTimes(1);
    controller.abort();
    const summary = await promise;
    expect(summary.shutdownRequested).toBe(true);
  });
});
