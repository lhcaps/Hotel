export type BookingMode = 'hourly' | 'overnight';

export interface BookingSearchState {
  readonly mode: BookingMode;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
}

export interface HourlyIntervalInput {
  readonly date: string;
  readonly time: string;
  readonly durationMinutes: number;
}

export interface HourlyInterval {
  readonly checkIn: string;
  readonly checkOut: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const HO_CHI_MINH_OFFSET_MINUTES = 7 * 60;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

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

function roundedDateParts(
  date: { year: number; month: number; day: number },
  time: string,
): { year: number; month: number; day: number; minutesOfDay: number } {
  const match = TIME_PATTERN.exec(time);
  if (match === null) throw new Error('interval.invalidTime');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const totalMinutes = hour * 60 + minute;
  const roundedTotal =
    totalMinutes === 0 || totalMinutes % 15 === 0
      ? totalMinutes
      : totalMinutes + (15 - (totalMinutes % 15));
  const offsetDays = Math.floor(roundedTotal / 1440);
  const minutesOfDay = roundedTotal % 1440;
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day));
  next.setUTCDate(next.getUTCDate() + offsetDays);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    minutesOfDay,
  };
}

export function buildHourlyInterval(input: HourlyIntervalInput): HourlyInterval {
  const dateMatch = DATE_PATTERN.exec(input.date);
  if (dateMatch === null) throw new Error('interval.invalidDate');
  const dateParts = ensureValidDate(dateMatch);
  const startParts = roundedDateParts(dateParts, input.time);
  const durationMinutes = input.durationMinutes;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 60 || durationMinutes > 1440) {
    throw new Error('interval.invalidDuration');
  }
  if (durationMinutes % 15 !== 0) {
    throw new Error('interval.durationNotDivisibleBy15');
  }
  const endTotalMinutes = startParts.minutesOfDay + durationMinutes;
  const endOffsetDays = Math.floor(endTotalMinutes / 1440);
  const endMinutesOfDay = endTotalMinutes % 1440;
  const startInstant = utcFromHoChiMinhDate(
    { year: startParts.year, month: startParts.month, day: startParts.day },
    0,
    startParts.minutesOfDay,
  );
  const endBase = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  endBase.setUTCDate(endBase.getUTCDate() + endOffsetDays);
  const endInstant = utcFromHoChiMinhDate(
    { year: endBase.getUTCFullYear(), month: endBase.getUTCMonth() + 1, day: endBase.getUTCDate() },
    0,
    endMinutesOfDay,
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
): Date {
  const dateOnlyUtc = new Date(Date.UTC(base.year, base.month - 1, base.day));
  dateOnlyUtc.setUTCDate(dateOnlyUtc.getUTCDate() + extraDays);
  return new Date(dateOnlyUtc.getTime() + (minutesOfDay - HO_CHI_MINH_OFFSET_MINUTES) * 60_000);
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
    mode: state.mode,
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
    (mode !== 'hourly' && mode !== 'overnight') ||
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
    mode,
    checkIn: normalizeBrowserDateTime(checkIn),
    checkOut: normalizeBrowserDateTime(checkOut),
    adults,
    children,
  };
}
