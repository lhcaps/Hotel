import { describe, expect, it } from 'vitest';

import { parseWorkerOperationalConfig, requireWorkerOperationalConfig } from './worker-config.js';

describe('worker operational config', () => {
  it('accepts continuous mode', () => {
    const result = parseWorkerOperationalConfig({
      WORKER_MODE: 'continuous',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.WORKER_MODE).toBe('continuous');
    }
  });

  it('accepts once mode', () => {
    const result = parseWorkerOperationalConfig({
      WORKER_MODE: 'once',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.WORKER_MODE).toBe('once');
    }
  });

  it('defaults to continuous mode when unspecified', () => {
    const result = parseWorkerOperationalConfig({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.WORKER_MODE).toBe('continuous');
    }
  });

  it('rejects an invalid mode value', () => {
    const result = parseWorkerOperationalConfig({
      WORKER_MODE: 'besteffort',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive intervals', () => {
    const result = parseWorkerOperationalConfig({
      WORKER_OUTBOX_INTERVAL_MS: '0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects intervals that exceed the upper bound', () => {
    const result = parseWorkerOperationalConfig({
      WORKER_OUTBOX_INTERVAL_MS: '5000000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer backoff values', () => {
    const result = parseWorkerOperationalConfig({
      WORKER_ERROR_BACKOFF_MS: '12.5',
    });
    expect(result.success).toBe(false);
  });

  it('rejects initial backoff larger than max backoff', () => {
    const result = parseWorkerOperationalConfig({
      WORKER_ERROR_BACKOFF_MS: '5000',
      WORKER_MAX_ERROR_BACKOFF_MS: '1000',
    });
    expect(result.success).toBe(false);
  });

  it('accepts the recommended defaults when supplied explicitly', () => {
    const result = parseWorkerOperationalConfig({
      WORKER_MODE: 'continuous',
      WORKER_OUTBOX_INTERVAL_MS: '2000',
      WORKER_EXPIRATION_INTERVAL_MS: '30000',
      WORKER_HOUSEKEEPING_REMINDER_INTERVAL_MS: '30000',
      WORKER_ERROR_BACKOFF_MS: '1000',
      WORKER_MAX_ERROR_BACKOFF_MS: '60000',
      WORKER_RECONCILIATION_BATCH_SIZE: '25',
      WORKER_RECONCILIATION_LEASE_TTL_MS: '120000',
      WORKER_RECONCILIATION_INTERVAL_MS: '30000',
      WORKER_RECONCILIATION_CONCURRENCY: '5',
      WORKER_RECONCILIATION_MAX_ATTEMPTS: '8',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        WORKER_MODE: 'continuous',
        WORKER_OUTBOX_INTERVAL_MS: 2000,
        WORKER_EXPIRATION_INTERVAL_MS: 30000,
        WORKER_HOUSEKEEPING_REMINDER_INTERVAL_MS: 30000,
        WORKER_ERROR_BACKOFF_MS: 1000,
        WORKER_MAX_ERROR_BACKOFF_MS: 60000,
        WORKER_RECONCILIATION_BATCH_SIZE: 25,
        WORKER_RECONCILIATION_LEASE_TTL_MS: 120000,
        WORKER_RECONCILIATION_INTERVAL_MS: 30000,
        WORKER_RECONCILIATION_CONCURRENCY: 5,
        WORKER_RECONCILIATION_MAX_ATTEMPTS: 8,
      });
    }
  });

  it('defaults reconciliation settings safely', () => {
    const result = parseWorkerOperationalConfig({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.WORKER_RECONCILIATION_BATCH_SIZE).toBe(25);
      expect(result.data.WORKER_RECONCILIATION_LEASE_TTL_MS).toBe(120_000);
      expect(result.data.WORKER_RECONCILIATION_INTERVAL_MS).toBe(30_000);
      expect(result.data.WORKER_RECONCILIATION_CONCURRENCY).toBe(5);
      expect(result.data.WORKER_RECONCILIATION_MAX_ATTEMPTS).toBe(8);
      expect(result.data.WORKER_HOUSEKEEPING_REMINDER_INTERVAL_MS).toBe(30_000);
    }
  });

  it('rejects reconciliation settings outside bounds', () => {
    expect(parseWorkerOperationalConfig({ WORKER_RECONCILIATION_BATCH_SIZE: '101' }).success).toBe(
      false,
    );
    expect(
      parseWorkerOperationalConfig({ WORKER_RECONCILIATION_LEASE_TTL_MS: '900' }).success,
    ).toBe(false);
    expect(parseWorkerOperationalConfig({ WORKER_RECONCILIATION_CONCURRENCY: '26' }).success).toBe(
      false,
    );
  });

  it('throws via requireWorkerOperationalConfig on invalid input', () => {
    expect(() =>
      requireWorkerOperationalConfig({
        WORKER_MODE: 'unsupported',
      }),
    ).toThrow(/worker operational config/);
  });
});
