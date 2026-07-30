import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeCountdown,
  computeServerOffsetMs,
  createServerClock,
  formatCountdown,
  serverNowMs,
} from '../src/lib/server-time';

const SERVER = '2027-01-10T03:00:00.000Z';
const SERVER_MS = Date.parse(SERVER);

describe('server-time helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SERVER));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives the clock offset from serverNow minus the client observed time', () => {
    const sample = { serverNow: new Date(SERVER), clientObservedAt: 1_000 };
    expect(computeServerOffsetMs(sample)).toBe(SERVER_MS - 1_000);
  });

  it('throws when serverNow is not a valid instant', () => {
    expect(() => createServerClock('not-a-date')).toThrowError(/Invalid serverNow/);
  });

  it('treats the count as expired when expiresAt has already passed relative to the saved offset', () => {
    const clock = createServerClock(SERVER, Date.now());
    const view = computeCountdown(clock, '2027-01-10T02:59:00.000Z');
    expect(view.expired).toBe(true);
    expect(view.remainingMs).toBeLessThan(0);
  });

  it('reports the correct remaining ms when expiresAt is one minute ahead of the saved serverNow', () => {
    const clock = createServerClock(SERVER, Date.now());
    const view = computeCountdown(clock, '2027-01-10T03:01:00.000Z');
    expect(view.remainingMs).toBe(60_000);
    expect(view.expired).toBe(false);
  });

  it('formats mm:ss with leading zeros and clamps to 00:00 when expired', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-1_000)).toBe('00:00');
    expect(formatCountdown(125_000)).toBe('02:05');
    expect(formatCountdown(900_000)).toBe('15:00');
  });

  it('projects server time by adding the saved offset to the current client clock', () => {
    const observedAt = Date.now();
    const clock = createServerClock(SERVER, observedAt);
    // Same instant: serverNowMs must equal SERVER_MS.
    expect(serverNowMs(clock)).toBe(SERVER_MS);
    // After 30s of client time: serverNowMs advances by 30s.
    vi.setSystemTime(new Date(observedAt + 30_000));
    expect(serverNowMs(clock)).toBe(SERVER_MS + 30_000);
  });
});
