export interface ServerClockSample {
  readonly serverNow: Date;
  readonly clientObservedAt: number;
}

export interface ServerClock {
  readonly sample: ServerClockSample;
  readonly offsetMs: number;
}

export function computeServerOffsetMs(sample: ServerClockSample): number {
  return sample.serverNow.getTime() - sample.clientObservedAt;
}

export function createServerClock(
  serverNowIso: string,
  clientObservedAt: number = Date.now(),
): ServerClock {
  const serverNow = new Date(serverNowIso);
  if (Number.isNaN(serverNow.getTime())) {
    throw new Error(`Invalid serverNow timestamp: ${serverNowIso}`);
  }
  const sample = { serverNow, clientObservedAt };
  return { sample, offsetMs: computeServerOffsetMs(sample) };
}

export function serverNowMs(clock: ServerClock): number {
  return Date.now() + clock.offsetMs;
}

export interface CountdownView {
  readonly remainingMs: number;
  readonly expired: boolean;
}

export function computeCountdown(
  clock: ServerClock,
  holdExpiresAtIso: string,
): CountdownView {
  const expiresAt = new Date(holdExpiresAtIso).getTime();
  const remaining = expiresAt - serverNowMs(clock);
  return { remainingMs: remaining, expired: remaining <= 0 };
}

export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '00:00';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
