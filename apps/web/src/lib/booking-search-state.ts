export interface BookingSearchState {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
}

export interface HourlyIntervalInput {
  readonly date: string;
  readonly time: string;
  readonly durationMinutes?: number;
  readonly durationSeconds?: number;
}

export interface HourlyInterval {
  readonly checkIn: string;
  readonly checkOut: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const HO_CHI_MINH_OFFSET_MINUTES = 7 * 60;

function ensureValidDate(parts: RegExpMatchArray): { year: number; month: number; day: number } {
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const sample = new Date(Date.UTC(year, month - 1, day));
  if (
    sample.getUTCFullYear() !== year ||
    sample.getUTCMonth() !== month - 1 ||
    sample.getUTCDate() !== day
  ) {
    throw new Error('interval.invalidDate');
  }
  return { year, month, day };
}

function exactDateParts(
  date: { year: number; month: number; day: number },
  time: string,
): { year: number; month: number; day: number; secondsOfDay: number } {
  const match = TIME_PATTERN.exec(time);
  if (match === null) throw new Error('interval.invalidTime');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  const totalSeconds = hour * 3_600 + minute * 60 + second;
  const offsetDays = Math.floor(totalSeconds / 86_400);
  const secondsOfDay = totalSeconds % 86_400;
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day));
  next.setUTCDate(next.getUTCDate() + offsetDays);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    secondsOfDay,
  };
}

export function buildHourlyInterval(input: HourlyIntervalInput): HourlyInterval {
  const dateMatch = DATE_PATTERN.exec(input.date);
  if (dateMatch === null) throw new Error('interval.invalidDate');
  const dateParts = ensureValidDate(dateMatch);
  const startParts = exactDateParts(dateParts, input.time);
  const durationSeconds = input.durationSeconds ?? (input.durationMinutes ?? Number.NaN) * 60;
  if (!Number.isInteger(durationSeconds) || durationSeconds < 3_600 || durationSeconds > 86_400) {
    throw new Error('interval.invalidDuration');
  }
  const endTotalSeconds = startParts.secondsOfDay + durationSeconds;
  const endOffsetDays = Math.floor(endTotalSeconds / 86_400);
  const endSecondsOfDay = endTotalSeconds % 86_400;
  const startInstant = utcFromHoChiMinhDate(
    { year: startParts.year, month: startParts.month, day: startParts.day },
    0,
    Math.floor(startParts.secondsOfDay / 60),
    startParts.secondsOfDay % 60,
  );
  const endBase = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  endBase.setUTCDate(endBase.getUTCDate() + endOffsetDays);
  const endInstant = utcFromHoChiMinhDate(
    { year: endBase.getUTCFullYear(), month: endBase.getUTCMonth() + 1, day: endBase.getUTCDate() },
    0,
    Math.floor(endSecondsOfDay / 60),
    endSecondsOfDay % 60,
  );
  if (endInstant.getTime() <= startInstant.getTime()) {
    throw new Error('interval.checkOutNotAfterCheckIn');
  }
  return {
    checkIn: formatWithOffset(startInstant),
    checkOut: formatWithOffset(endInstant),
  };
}

function utcFromHoChiMinhDate(
  base: { year: number; month: number; day: number },
  extraDays: number,
  minutesOfDay: number,
  seconds = 0,
): Date {
  const dateOnlyUtc = new Date(Date.UTC(base.year, base.month - 1, base.day));
  dateOnlyUtc.setUTCDate(dateOnlyUtc.getUTCDate() + extraDays);
  return new Date(
    dateOnlyUtc.getTime() + (minutesOfDay - HO_CHI_MINH_OFFSET_MINUTES) * 60_000 + seconds * 1_000,
  );
}

function formatWithOffset(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  }
  return `${lookup['year'] ?? '0000'}-${lookup['month'] ?? '01'}-${lookup['day'] ?? '01'}T${lookup['hour'] ?? '00'}:${lookup['minute'] ?? '00'}:${lookup['second'] ?? '00'}+07:00`;
}

function normalizeBrowserDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value;
}

export function toBookingSearchQuery(state: BookingSearchState) {
  const query = new URLSearchParams({
    checkIn: state.checkIn,
    checkOut: state.checkOut,
    adults: String(state.adults),
    children: String(state.children),
  });
  return query.toString();
}

export function readBookingSearchQuery(input: URLSearchParams): BookingSearchState | undefined {
  const mode = input.get('mode');
  const checkIn = input.get('checkIn');
  const checkOut = input.get('checkOut');
  const adults = Number(input.get('adults'));
  const children = Number(input.get('children'));
  if (
    (mode !== null && mode !== 'hourly' && mode !== 'overnight' && mode !== 'multi_night') ||
    checkIn === null ||
    checkOut === null ||
    !Number.isInteger(adults) ||
    adults < 1 ||
    !Number.isInteger(children) ||
    children < 0
  ) {
    return undefined;
  }
  return {
    checkIn: normalizeBrowserDateTime(checkIn),
    checkOut: normalizeBrowserDateTime(checkOut),
    adults,
    children,
  };
}
