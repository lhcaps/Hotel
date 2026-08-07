'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import {
  buildHourlyInterval,
  readBookingSearchQuery,
  toBookingSearchQuery,
  type BookingMode,
  type BookingSearchState,
} from '../lib/booking-search-state';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

const FIVE_MINUTE_MS = 5 * 60_000;

type OvernightWindow = '21-09' | '22-10';

const OVERNIGHT_WINDOWS: Readonly<Record<OvernightWindow, { start: string; end: string }>> = {
  '21-09': { start: '21:00', end: '09:00' },
  '22-10': { start: '22:00', end: '10:00' },
};

function withOffset(value: string) {
  return `${value}:00+07:00`;
}

function addDaysToDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return date;
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(
    next.getUTCDate(),
  ).padStart(2, '0')}`;
}

function overnightWindowFromTimes(checkInTime: string, checkOutTime: string): OvernightWindow {
  return (
    (Object.entries(OVERNIGHT_WINDOWS).find(
      ([, window]) => window.start === checkInTime && window.end === checkOutTime,
    )?.[0] as OvernightWindow | undefined) ?? '21-09'
  );
}

function inputDate(value: string | undefined) {
  return value?.slice(0, 10) ?? '';
}

function inputTime(value: string | undefined) {
  return value?.slice(11, 19) ?? '';
}

function durationSeconds(checkIn: string | undefined, checkOut: string | undefined) {
  if (!checkIn || !checkOut) return 10_800;
  const duration = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 1_000;
  return Number.isFinite(duration) && duration >= 3_600 ? duration : 10_800;
}

function timeParts(time: string) {
  const [hour = Number.NaN, minute = Number.NaN, second = 0] = time.split(':').map(Number);
  return (
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59 &&
    Number.isInteger(second) &&
    second >= 0 &&
    second <= 59
  );
}

function secondsSinceMidnight(time: string) {
  if (!timeParts(time)) return undefined;
  const [hour = 0, minute = 0, second = 0] = time.split(':').map(Number);
  return hour * 3_600 + minute * 60 + second;
}

function addSecondsToTime(time: string, duration: number) {
  const start = secondsSinceMidnight(time);
  if (start === undefined) return '';
  const end = (start + duration) % 86_400;
  return `${String(Math.floor(end / 3_600)).padStart(2, '0')}:${String(Math.floor((end % 3_600) / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function durationFromVisibleTimes(start: string, end: string) {
  const startSeconds = secondsSinceMidnight(start);
  const endSeconds = secondsSinceMidnight(end);
  if (startSeconds === undefined || endSeconds === undefined) {
    return undefined;
  }
  const sameDayDuration = endSeconds - startSeconds;
  return sameDayDuration >= 0 ? sameDayDuration || 86_400 : sameDayDuration + 86_400;
}

export function AvailabilitySearchForm({
  variant = 'search',
  embedded = false,
  onSearch,
}: Readonly<{
  variant?: 'home' | 'search';
  embedded?: boolean;
  onSearch?: (state: BookingSearchState) => void;
}>) {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const queryState = readBookingSearchQuery(searchParams);
  const initialMode = queryState?.mode ?? 'overnight';
  const initialDuration = String(durationSeconds(queryState?.checkIn, queryState?.checkOut));
  const initialHourlyStart = useMemo(
    () => inputTime(queryState?.checkIn) || '00:00:00',
    [queryState?.checkIn],
  );
  const initialHourlyEnd = useMemo(() => {
    const raw = inputTime(queryState?.checkOut);
    if (raw !== '') return raw;
    return addSecondsToTime(initialHourlyStart, Number(initialDuration));
  }, [initialDuration, initialHourlyStart, queryState?.checkOut]);
  const [bookingMode, setBookingMode] = useState<BookingMode>(initialMode);
  const [hourlyDate, setHourlyDate] = useState(inputDate(queryState?.checkIn));
  const [hourlyStart, setHourlyStart] = useState(initialHourlyStart);
  const [hourlyEnd, setHourlyEnd] = useState(initialHourlyEnd);
  const [hourlyDuration, setHourlyDuration] = useState(
    initialDuration === '10800' || initialDuration === '18000' ? initialDuration : 'custom',
  );
  const [overnightDate, setOvernightDate] = useState(inputDate(queryState?.checkIn));
  const [overnightStartTime, setOvernightStartTime] = useState(
    inputTime(queryState?.checkIn).slice(0, 5) || '21:00',
  );
  const [overnightCheckOutDate, setOvernightCheckOutDate] = useState(
    inputDate(queryState?.checkOut) ||
      (inputDate(queryState?.checkIn) ? addDaysToDate(inputDate(queryState?.checkIn), 1) : ''),
  );
  const [overnightEndTime, setOvernightEndTime] = useState(
    inputTime(queryState?.checkOut).slice(0, 5) || '09:00',
  );
  const [overnightWindow, setOvernightWindow] = useState<OvernightWindow>(
    overnightWindowFromTimes(
      inputTime(queryState?.checkIn) || '21:00',
      inputTime(queryState?.checkOut) || '09:00',
    ),
  );
  const [adults, setAdults] = useState(String(queryState?.adults ?? 1));
  const [children, setChildren] = useState(String(queryState?.children ?? 0));
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!queryState) return;
    const nextDuration = String(durationSeconds(queryState.checkIn, queryState.checkOut));
    setBookingMode(queryState.mode);
    setHourlyDate(inputDate(queryState.checkIn));
    setHourlyStart(inputTime(queryState.checkIn));
    setHourlyEnd(inputTime(queryState.checkOut));
    setHourlyDuration(
      nextDuration === '10800' || nextDuration === '18000' ? nextDuration : 'custom',
    );
    setOvernightDate(inputDate(queryState.checkIn));
    setOvernightStartTime(inputTime(queryState.checkIn).slice(0, 5));
    setOvernightCheckOutDate(
      inputDate(queryState.checkOut) || addDaysToDate(inputDate(queryState.checkIn), 1),
    );
    setOvernightEndTime(inputTime(queryState.checkOut).slice(0, 5));
    setOvernightWindow(
      overnightWindowFromTimes(
        inputTime(queryState.checkIn) || '21:00',
        inputTime(queryState.checkOut) || '09:00',
      ),
    );
    setAdults(String(queryState.adults));
    setChildren(String(queryState.children));
  }, [queryKey]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedHourlyDate = String(form.get('hourlyDate') ?? '');
    const submittedHourlyStart = String(form.get('hourlyStart') ?? '');
    const submittedHourlyEnd = String(form.get('hourlyEnd') ?? '');
    const submittedOvernightDate = String(form.get('overnightDate') ?? '');
    const submittedOvernightStart = String(form.get('overnightStart') ?? '');
    const submittedOvernightCheckOutDate = String(form.get('overnightCheckOutDate') ?? '');
    const submittedOvernightEnd = String(form.get('overnightEnd') ?? '');
    const submittedAdults = Number(form.get('adults'));
    const submittedChildren = Number(form.get('children'));
    const submittedDuration = durationFromVisibleTimes(submittedHourlyStart, submittedHourlyEnd);

    if (bookingMode === 'hourly') {
      if (!timeParts(submittedHourlyStart) || !timeParts(submittedHourlyEnd)) {
        setError(translate(locale, 'search.invalidInterval'));
        return;
      }
      if (submittedDuration === undefined) {
        setError(translate(locale, 'search.hourlyCrossesMidnight'));
        return;
      }
    } else {
      if (
        !submittedOvernightDate ||
        !submittedOvernightCheckOutDate ||
        !timeParts(submittedOvernightStart) ||
        !timeParts(submittedOvernightEnd)
      ) {
        setError(translate(locale, 'search.invalidInterval'));
        return;
      }
    }

    type IntervalResult = { readonly checkIn: string; readonly checkOut: string } | undefined;
    let interval: IntervalResult;
    try {
      interval =
        bookingMode === 'hourly'
          ? submittedHourlyDate && submittedHourlyStart && submittedDuration !== undefined
            ? buildHourlyInterval({
                date: submittedHourlyDate,
                time: submittedHourlyStart,
                durationSeconds: submittedDuration,
              })
            : undefined
          : submittedOvernightDate && submittedOvernightCheckOutDate
            ? {
                checkIn: withOffset(
                  `${submittedOvernightDate}T${submittedOvernightStart.slice(0, 5)}`,
                ),
                checkOut: withOffset(
                  `${submittedOvernightCheckOutDate}T${submittedOvernightEnd.slice(0, 5)}`,
                ),
              }
            : undefined;
    } catch {
      setError(translate(locale, 'search.invalidInterval'));
      return;
    }

    if (
      !interval ||
      new Date(interval.checkIn).getTime() <= Date.now() ||
      !Number.isInteger(submittedAdults) ||
      submittedAdults < 1 ||
      !Number.isInteger(submittedChildren) ||
      submittedChildren < 0 ||
      new Date(interval.checkOut).getTime() <= new Date(interval.checkIn).getTime()
    ) {
      setError(
        interval && new Date(interval.checkIn).getTime() <= Date.now()
          ? translate(locale, 'search.intervalMustBeFuture')
          : translate(locale, 'search.invalidInterval'),
      );
      return;
    }
    setError(undefined);
    const state: BookingSearchState = {
      mode: bookingMode,
      ...interval,
      adults: submittedAdults,
      children: submittedChildren,
    };
    if (onSearch) {
      onSearch(state);
      return;
    }
    router.push(`/booking/search?${toBookingSearchQuery(state)}`);
  }

  return (
    <section
      className={`availability-page availability-page--${variant}`}
      aria-label={translate(locale, 'search.heading')}
    >
      {!embedded ? (
        <header className="availability-page__intro">
          <h1>{translate(locale, 'search.heading')}</h1>
          <p>{translate(locale, 'search.description')}</p>
        </header>
      ) : null}
      <form
        action="/booking/search"
        aria-busy={!isHydrated}
        className="availability-search"
        method="get"
        onSubmit={submit}
      >
        <input name="mode" type="hidden" value={bookingMode} />
        <ToggleGroup
          aria-label={translate(locale, 'search.modeLabel')}
          className="availability-search__mode-toggle"
          onValueChange={(value) => {
            if (value.length > 0) setBookingMode((value[0] ?? 'overnight') as BookingMode);
          }}
          value={[bookingMode]}
        >
          <ToggleGroupItem
            aria-label={translate(locale, 'search.modeHourly')}
            data-testid="availability-mode-hourly"
            onPressedChange={(pressed) => {
              if (pressed) setBookingMode('hourly');
            }}
            value="hourly"
          >
            {translate(locale, 'search.modeHourly')}
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label={translate(locale, 'search.modeOvernight')}
            data-testid="availability-mode-overnight"
            onPressedChange={(pressed) => {
              if (pressed) setBookingMode('overnight');
            }}
            value="overnight"
          >
            {translate(locale, 'search.modeOvernight')}
          </ToggleGroupItem>
          <ToggleGroupItem
            aria-label={translate(locale, 'search.modeMultiNight')}
            data-testid="availability-mode-multi-night"
            onPressedChange={(pressed) => {
              if (pressed) setBookingMode('multi_night');
            }}
            value="multi_night"
          >
            {translate(locale, 'search.modeMultiNight')}
          </ToggleGroupItem>
        </ToggleGroup>
        {bookingMode === 'hourly' ? (
          <FieldGroup className="availability-search__fields">
            <Field>
              <FieldLabel htmlFor="hourly-date">
                {translate(locale, 'search.hourlyDate')}
              </FieldLabel>
              <Input
                data-testid="availability-hourly-date"
                id="hourly-date"
                name="hourlyDate"
                disabled={!isHydrated}
                onChange={(event) => setHourlyDate(event.target.value)}
                required
                type="date"
                value={hourlyDate}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="hourly-start">
                {translate(locale, 'search.hourlyStart')}
              </FieldLabel>
              <Input
                aria-invalid={hourlyStart !== '' && !timeParts(hourlyStart)}
                data-testid="availability-hourly-start"
                id="hourly-start"
                name="hourlyStart"
                disabled={!isHydrated}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setHourlyStart(nextStart);
                  if (hourlyDuration !== 'custom') {
                    setHourlyEnd(addSecondsToTime(nextStart, Number(hourlyDuration)));
                  }
                }}
                required
                step={1}
                type="time"
                value={hourlyStart}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="hourly-end">{translate(locale, 'search.hourlyEnd')}</FieldLabel>
              <Input
                aria-invalid={hourlyEnd !== '' && !timeParts(hourlyEnd)}
                data-testid="availability-hourly-end"
                id="hourly-end"
                name="hourlyEnd"
                disabled={!isHydrated}
                onChange={(event) => {
                  const nextEnd = event.target.value;
                  setHourlyEnd(nextEnd);
                  const nextDuration = durationFromVisibleTimes(hourlyStart, nextEnd);
                  setHourlyDuration(
                    nextDuration === 10_800
                      ? '10800'
                      : nextDuration === 18_000
                        ? '18000'
                        : 'custom',
                  );
                }}
                required
                step={1}
                type="time"
                value={hourlyEnd}
              />
            </Field>
            <Field>
              <FieldLabel>{translate(locale, 'search.duration')}</FieldLabel>
              <ToggleGroup
                onValueChange={(value) => {
                  const nextDuration = (value[0] ?? 'custom') as string;
                  if (value.length === 0) return;
                  setHourlyDuration(nextDuration);
                  if (nextDuration !== 'custom') {
                    setHourlyEnd(addSecondsToTime(hourlyStart, Number(nextDuration)));
                  }
                }}
                value={[hourlyDuration]}
              >
                <ToggleGroupItem
                  aria-label={translate(locale, 'search.quickThreeHours')}
                  onPressedChange={(pressed) => {
                    if (pressed) {
                      setHourlyDuration('10800');
                      setHourlyEnd(addSecondsToTime(hourlyStart, 10_800));
                    }
                  }}
                  value="10800"
                >
                  {translate(locale, 'search.quickThreeHours')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  aria-label={translate(locale, 'search.quickFiveHours')}
                  onPressedChange={(pressed) => {
                    if (pressed) {
                      setHourlyDuration('18000');
                      setHourlyEnd(addSecondsToTime(hourlyStart, 18_000));
                    }
                  }}
                  value="18000"
                >
                  {translate(locale, 'search.quickFiveHours')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  aria-label={translate(locale, 'search.customDuration')}
                  onPressedChange={(pressed) => {
                    if (pressed) setHourlyDuration('custom');
                  }}
                  value="custom"
                >
                  {translate(locale, 'search.customDuration')}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>
        ) : (
          <FieldGroup className="availability-search__fields">
            <Field>
              <FieldLabel htmlFor="overnight-date">
                {translate(locale, 'search.checkIn')}
              </FieldLabel>
              <Input
                data-testid="availability-overnight-date"
                id="overnight-date"
                name="overnightDate"
                disabled={!isHydrated}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setOvernightDate(nextDate);
                  if (nextDate && !overnightCheckOutDate) {
                    setOvernightCheckOutDate(addDaysToDate(nextDate, 1));
                  }
                }}
                required
                type="date"
                value={overnightDate}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="overnight-start">
                {translate(locale, 'search.checkInTime')}
              </FieldLabel>
              <Input
                data-testid="availability-overnight-start"
                id="overnight-start"
                name="overnightStart"
                disabled={!isHydrated}
                onChange={(event) => setOvernightStartTime(event.target.value)}
                required
                step={60}
                type="time"
                value={overnightStartTime}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="overnight-check-out-date">
                {translate(locale, 'search.checkOutDate')}
              </FieldLabel>
              <Input
                data-testid="availability-overnight-check-out-date"
                id="overnight-check-out-date"
                name="overnightCheckOutDate"
                disabled={!isHydrated}
                onChange={(event) => setOvernightCheckOutDate(event.target.value)}
                required
                type="date"
                value={overnightCheckOutDate}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="overnight-end">
                {translate(locale, 'search.checkOutTime')}
              </FieldLabel>
              <Input
                data-testid="availability-overnight-end"
                id="overnight-end"
                name="overnightEnd"
                disabled={!isHydrated}
                onChange={(event) => setOvernightEndTime(event.target.value)}
                required
                step={60}
                type="time"
                value={overnightEndTime}
              />
            </Field>
            {bookingMode === 'overnight' ? (
              <Field>
                <FieldLabel>{translate(locale, 'search.overnightWindow')}</FieldLabel>
                <input name="overnightWindow" type="hidden" value={overnightWindow} />
                <ToggleGroup
                  aria-label={translate(locale, 'search.overnightWindow')}
                  onValueChange={(value) => {
                    if (value.length === 0) return;
                    const nextWindow = value[0] as OvernightWindow;
                    const preset = OVERNIGHT_WINDOWS[nextWindow];
                    setOvernightWindow(nextWindow);
                    setOvernightStartTime(preset.start);
                    setOvernightEndTime(preset.end);
                    if (overnightDate) {
                      setOvernightCheckOutDate(addDaysToDate(overnightDate, 1));
                    }
                  }}
                  value={[overnightWindow]}
                >
                  <ToggleGroupItem
                    aria-label={translate(locale, 'search.overnightWindow2109')}
                    onPressedChange={(pressed) => {
                      if (pressed) {
                        setOvernightWindow('21-09');
                        setOvernightStartTime('21:00');
                        setOvernightEndTime('09:00');
                        if (overnightDate) {
                          setOvernightCheckOutDate(addDaysToDate(overnightDate, 1));
                        }
                      }
                    }}
                    value="21-09"
                  >
                    {translate(locale, 'search.overnightWindow2109')}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    aria-label={translate(locale, 'search.overnightWindow2210')}
                    onPressedChange={(pressed) => {
                      if (pressed) {
                        setOvernightWindow('22-10');
                        setOvernightStartTime('22:00');
                        setOvernightEndTime('10:00');
                        if (overnightDate) {
                          setOvernightCheckOutDate(addDaysToDate(overnightDate, 1));
                        }
                      }
                    }}
                    value="22-10"
                  >
                    {translate(locale, 'search.overnightWindow2210')}
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
            ) : null}
          </FieldGroup>
        )}
        <FieldGroup className="availability-search__fields availability-search__fields--guests">
          <Field>
            <FieldLabel htmlFor="adults">{translate(locale, 'search.adults')}</FieldLabel>
            <Input
              data-testid="availability-adults"
              id="adults"
              name="adults"
              min="1"
              disabled={!isHydrated}
              onChange={(event) => setAdults(event.target.value)}
              required
              type="number"
              value={adults}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="children">{translate(locale, 'search.children')}</FieldLabel>
            <Input
              data-testid="availability-children"
              id="children"
              name="children"
              min="0"
              disabled={!isHydrated}
              onChange={(event) => setChildren(event.target.value)}
              required
              type="number"
              value={children}
            />
          </Field>
          <Button data-testid="availability-submit" disabled={!isHydrated} size="lg" type="submit">
            {translate(locale, 'search.submit')}
          </Button>
        </FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{translate(locale, 'search.error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </section>
  );
}

// Re-export so existing callers don't need to update imports.
export { FIVE_MINUTE_MS };
