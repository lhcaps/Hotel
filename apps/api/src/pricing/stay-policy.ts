import type { AvailabilityPolicy } from '@room/contracts';

export type StayMode = 'hourly' | 'overnight';

interface LocalDateTimeParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function localDateTimeParts(instant: string, timezone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function localDayNumber(parts: LocalDateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000;
}

export function isSupportedOvernightWindow(
  checkIn: string,
  checkOut: string,
  timezone: string,
): boolean {
  const start = localDateTimeParts(checkIn, timezone);
  const end = localDateTimeParts(checkOut, timezone);
  if (localDayNumber(end) - localDayNumber(start) !== 1) return false;
  const exactTime = (value: LocalDateTimeParts, hour: number) =>
    value.hour === hour && value.minute === 0 && value.second === 0;
  return (
    (exactTime(start, 21) && exactTime(end, 9)) || (exactTime(start, 22) && exactTime(end, 10))
  );
}

export function isWithinPropertyStayPolicy(
  checkIn: string,
  checkOut: string,
  policy: AvailabilityPolicy,
  now = Date.now(),
  mode?: StayMode,
  timezone?: string,
): boolean {
  const checkInMs = new Date(checkIn).getTime();
  const checkOutMs = new Date(checkOut).getTime();
  const durationMinutes = Math.ceil((checkOutMs - checkInMs) / 60_000);
  const leadMinutes = (checkInMs - now) / 60_000;
  const latestCheckIn = now + policy.maximumAdvanceBookingDays * 86_400_000;
  return (
    durationMinutes >= policy.minimumStayMinutes &&
    durationMinutes <= policy.maximumStayMinutes &&
    leadMinutes >= policy.minimumLeadTimeMinutes &&
    checkInMs <= latestCheckIn &&
    (mode !== 'overnight' ||
      (timezone !== undefined && isSupportedOvernightWindow(checkIn, checkOut, timezone)))
  );
}

export function propertyStayPolicy(row: {
  readonly minimumStayMinutes: number;
  readonly maximumStayMinutes: number;
  readonly minimumLeadTimeMinutes: number;
  readonly maximumAdvanceBookingDays: number;
  readonly defaultOvernightDurationMinutes: number;
}): AvailabilityPolicy {
  return {
    minimumStayMinutes: row.minimumStayMinutes,
    maximumStayMinutes: row.maximumStayMinutes,
    minimumLeadTimeMinutes: row.minimumLeadTimeMinutes,
    maximumAdvanceBookingDays: row.maximumAdvanceBookingDays,
    defaultOvernightDurationMinutes: row.defaultOvernightDurationMinutes,
  };
}
