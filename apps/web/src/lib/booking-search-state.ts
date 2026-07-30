export type BookingMode = 'hourly' | 'overnight';

export interface BookingSearchState {
  readonly mode: BookingMode;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
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
