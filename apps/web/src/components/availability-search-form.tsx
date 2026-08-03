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

const QUARTER_HOUR_MS = 15 * 60_000;
const FIVE_MINUTE_MS = 5 * 60_000;

function withOffset(value: string) {
  return `${value}:00+07:00`;
}

function inputDateTime(value: string | undefined) {
  return value?.slice(0, 16) ?? '';
}

function inputDate(value: string | undefined) {
  return value?.slice(0, 10) ?? '';
}

function inputTime(value: string | undefined) {
  return value?.slice(11, 16) ?? '';
}

function durationMinutes(checkIn: string | undefined, checkOut: string | undefined) {
  if (!checkIn || !checkOut) return 180;
  const duration = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60_000;
  return Number.isFinite(duration) && duration >= 60 ? duration : 180;
}

function isQuarterHour(time: string) {
  const [hour = Number.NaN, minute = Number.NaN] = time.split(':').map(Number);
  return (
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute % 15 === 0
  );
}

function minutesSinceMidnight(time: string) {
  if (!isQuarterHour(time)) return undefined;
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function addMinutesToTime(time: string, duration: number) {
  const start = minutesSinceMidnight(time);
  if (start === undefined) return '';
  const end = (start + duration) % (24 * 60);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function durationFromVisibleTimes(start: string, end: string) {
  const startMinutes = minutesSinceMidnight(start);
  const endMinutes = minutesSinceMidnight(end);
  if (startMinutes === undefined || endMinutes === undefined || endMinutes <= startMinutes) {
    return undefined;
  }
  return endMinutes - startMinutes;
}

function roundUpToNextQuarterHour(time: string) {
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '00:00';
  const total = hour * 60 + minute;
  const rounded = Math.ceil(total / 15) * 15;
  const newHour = Math.floor(rounded / 60) % 24;
  const newMinute = rounded % 60;
  return `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
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
  const initialDuration = String(durationMinutes(queryState?.checkIn, queryState?.checkOut));
  const initialHourlyStart = useMemo(() => {
    const raw = inputTime(queryState?.checkIn);
    if (raw === '' || !isQuarterHour(raw)) return roundUpToNextQuarterHour(raw || '00:00');
    return raw;
  }, [queryState?.checkIn]);
  const initialHourlyEnd = useMemo(() => {
    const raw = inputTime(queryState?.checkOut);
    if (raw !== '' && isQuarterHour(raw)) return raw;
    return addMinutesToTime(initialHourlyStart, Number(initialDuration));
  }, [initialDuration, initialHourlyStart, queryState?.checkOut]);
  const [bookingMode, setBookingMode] = useState<BookingMode>(initialMode);
  const [hourlyDate, setHourlyDate] = useState(inputDate(queryState?.checkIn));
  const [hourlyStart, setHourlyStart] = useState(initialHourlyStart);
  const [hourlyEnd, setHourlyEnd] = useState(initialHourlyEnd);
  const [hourlyDuration, setHourlyDuration] = useState(
    initialDuration === '180' || initialDuration === '300' ? initialDuration : 'custom',
  );
  const [checkIn, setCheckIn] = useState(inputDateTime(queryState?.checkIn));
  const [checkOut, setCheckOut] = useState(inputDateTime(queryState?.checkOut));
  const [adults, setAdults] = useState(String(queryState?.adults ?? 1));
  const [children, setChildren] = useState(String(queryState?.children ?? 0));
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!queryState) return;
    const nextDuration = String(durationMinutes(queryState.checkIn, queryState.checkOut));
    setBookingMode(queryState.mode);
    setHourlyDate(inputDate(queryState.checkIn));
    setHourlyStart(inputTime(queryState.checkIn));
    setHourlyEnd(inputTime(queryState.checkOut));
    setHourlyDuration(nextDuration === '180' || nextDuration === '300' ? nextDuration : 'custom');
    setCheckIn(inputDateTime(queryState.checkIn));
    setCheckOut(inputDateTime(queryState.checkOut));
    setAdults(String(queryState.adults));
    setChildren(String(queryState.children));
  }, [queryKey]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedHourlyDate = String(form.get('hourlyDate') ?? '');
    const submittedHourlyStart = String(form.get('hourlyStart') ?? '');
    const submittedHourlyEnd = String(form.get('hourlyEnd') ?? '');
    const submittedCheckIn = String(form.get('checkIn') ?? '');
    const submittedCheckOut = String(form.get('checkOut') ?? '');
    const submittedAdults = Number(form.get('adults'));
    const submittedChildren = Number(form.get('children'));
    const submittedDuration = durationFromVisibleTimes(submittedHourlyStart, submittedHourlyEnd);

    if (bookingMode === 'hourly') {
      if (!isQuarterHour(submittedHourlyStart) || !isQuarterHour(submittedHourlyEnd)) {
        setError(translate(locale, 'search.invalidInterval'));
        return;
      }
      if (submittedDuration === undefined) {
        setError(translate(locale, 'search.hourlyCrossesMidnight'));
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
                durationMinutes: submittedDuration,
              })
            : undefined
          : submittedCheckIn && submittedCheckOut
            ? {
                checkIn: withOffset(submittedCheckIn),
                checkOut: withOffset(submittedCheckOut),
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
          <ToggleGroupItem aria-label={translate(locale, 'search.modeHourly')} value="hourly">
            {translate(locale, 'search.modeHourly')}
          </ToggleGroupItem>
          <ToggleGroupItem aria-label={translate(locale, 'search.modeOvernight')} value="overnight">
            {translate(locale, 'search.modeOvernight')}
          </ToggleGroupItem>
        </ToggleGroup>
        {bookingMode === 'hourly' ? (
          <FieldGroup className="availability-search__fields">
            <Field>
              <FieldLabel htmlFor="hourly-date">
                {translate(locale, 'search.hourlyDate')}
              </FieldLabel>
              <Input
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
                aria-invalid={hourlyStart !== '' && !isQuarterHour(hourlyStart)}
                id="hourly-start"
                name="hourlyStart"
                disabled={!isHydrated}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setHourlyStart(nextStart);
                  if (hourlyDuration !== 'custom') {
                    setHourlyEnd(addMinutesToTime(nextStart, Number(hourlyDuration)));
                  }
                }}
                required
                step={60 * 15}
                type="time"
                value={hourlyStart}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="hourly-end">{translate(locale, 'search.hourlyEnd')}</FieldLabel>
              <Input
                aria-invalid={hourlyEnd !== '' && !isQuarterHour(hourlyEnd)}
                id="hourly-end"
                name="hourlyEnd"
                disabled={!isHydrated}
                onChange={(event) => {
                  const nextEnd = event.target.value;
                  setHourlyEnd(nextEnd);
                  const nextDuration = durationFromVisibleTimes(hourlyStart, nextEnd);
                  setHourlyDuration(
                    nextDuration === 180 ? '180' : nextDuration === 300 ? '300' : 'custom',
                  );
                }}
                required
                step={60 * 15}
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
                    setHourlyEnd(addMinutesToTime(hourlyStart, Number(nextDuration)));
                  }
                }}
                value={[hourlyDuration]}
              >
                <ToggleGroupItem
                  aria-label={translate(locale, 'search.quickThreeHours')}
                  value="180"
                >
                  {translate(locale, 'search.quickThreeHours')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  aria-label={translate(locale, 'search.quickFiveHours')}
                  value="300"
                >
                  {translate(locale, 'search.quickFiveHours')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  aria-label={translate(locale, 'search.customDuration')}
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
              <FieldLabel htmlFor="check-in">{translate(locale, 'search.checkIn')}</FieldLabel>
              <Input
                id="check-in"
                name="checkIn"
                disabled={!isHydrated}
                onChange={(event) => setCheckIn(event.target.value)}
                required
                step={60 * 15}
                type="datetime-local"
                value={checkIn}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="check-out">{translate(locale, 'search.checkOut')}</FieldLabel>
              <Input
                id="check-out"
                name="checkOut"
                disabled={!isHydrated}
                onChange={(event) => setCheckOut(event.target.value)}
                required
                step={60 * 15}
                type="datetime-local"
                value={checkOut}
              />
            </Field>
          </FieldGroup>
        )}
        <FieldGroup className="availability-search__fields availability-search__fields--guests">
          <Field>
            <FieldLabel htmlFor="adults">{translate(locale, 'search.adults')}</FieldLabel>
            <Input
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
          <Button disabled={!isHydrated} size="lg" type="submit">
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
export { FIVE_MINUTE_MS, QUARTER_HOUR_MS };
