import type { AdminBookingListQuery } from '@room/contracts';

export interface AdminBookingRepositoryQuery extends Omit<
  AdminBookingListQuery,
  'checkInFrom' | 'checkInTo'
> {
  readonly checkInFrom?: Date;
  readonly checkInToExclusive?: Date;
}

interface CalendarDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parseCalendarDate(value: string): CalendarDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) throw new Error('Invalid admin booking calendar date.');
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const sample = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    sample.getUTCFullYear() !== parts.year ||
    sample.getUTCMonth() !== parts.month - 1 ||
    sample.getUTCDate() !== parts.day
  ) {
    throw new Error('Invalid admin booking calendar date.');
  }
  return parts;
}

function timezoneOffsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  if (offset === 'GMT') return 0;
  const match = /^GMT([+-])(\d{2})(?::(\d{2}))?$/u.exec(offset);
  if (match === null) throw new Error(`Unsupported property timezone offset: ${offset}`);
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '+' ? minutes : -minutes;
}

function localMidnightToUtc(parts: CalendarDateParts, timezone: string): Date {
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const firstOffset = timezoneOffsetMinutes(new Date(localAsUtc), timezone);
  const firstCandidate = new Date(localAsUtc - firstOffset * 60_000);
  const resolvedOffset = timezoneOffsetMinutes(firstCandidate, timezone);
  return new Date(localAsUtc - resolvedOffset * 60_000);
}

function nextCalendarDate(parts: CalendarDateParts): CalendarDateParts {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function toAdminBookingRepositoryQuery(
  query: AdminBookingListQuery,
  timezone: string,
): AdminBookingRepositoryQuery {
  const { checkInFrom, checkInTo, ...rest } = query;
  const fromParts = checkInFrom === undefined ? undefined : parseCalendarDate(checkInFrom);
  const toParts = checkInTo === undefined ? undefined : parseCalendarDate(checkInTo);
  return {
    ...rest,
    ...(fromParts === undefined ? {} : { checkInFrom: localMidnightToUtc(fromParts, timezone) }),
    ...(toParts === undefined
      ? {}
      : { checkInToExclusive: localMidnightToUtc(nextCalendarDate(toParts), timezone) }),
  };
}
