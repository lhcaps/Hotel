'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  readBookingSearchQuery,
  toBookingSearchQuery,
  type BookingSearchState,
} from '../lib/booking-search-state';
import { translate } from '../lib/i18n/messages';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { useLocale } from './locale-provider';

const FIVE_MINUTE_MS = 5 * 60_000;

function withOffset(date: string, time: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return undefined;
  return `${date}T${time}:00+07:00`;
}

function inputDate(value: string | undefined): string {
  return value?.slice(0, 10) ?? '';
}

function inputTime(value: string | undefined): string {
  return value?.slice(11, 16) ?? '';
}

function nextDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
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
  const queryState = readBookingSearchQuery(searchParams);
  const [checkInDate, setCheckInDate] = useState(inputDate(queryState?.checkIn));
  const [checkInTime, setCheckInTime] = useState(inputTime(queryState?.checkIn));
  const [checkOutDate, setCheckOutDate] = useState(inputDate(queryState?.checkOut));
  const [checkOutTime, setCheckOutTime] = useState(inputTime(queryState?.checkOut));
  const [adults, setAdults] = useState(String(queryState?.adults ?? 1));
  const [children, setChildren] = useState(String(queryState?.children ?? 0));
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (queryState === undefined) return;
    setCheckInDate(inputDate(queryState.checkIn));
    setCheckInTime(inputTime(queryState.checkIn));
    setCheckOutDate(inputDate(queryState.checkOut));
    setCheckOutTime(inputTime(queryState.checkOut));
    setAdults(String(queryState.adults));
    setChildren(String(queryState.children));
  }, [searchParams, queryState]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedAdults = Number(adults);
    const submittedChildren = Number(children);
    const checkIn = withOffset(checkInDate, checkInTime);
    const checkOut = withOffset(checkOutDate, checkOutTime);
    if (
      checkIn === undefined ||
      checkOut === undefined ||
      !Number.isInteger(submittedAdults) ||
      submittedAdults < 1 ||
      !Number.isInteger(submittedChildren) ||
      submittedChildren < 0 ||
      new Date(checkOut).getTime() <= new Date(checkIn).getTime()
    ) {
      setError(translate(locale, 'search.invalidInterval'));
      return;
    }
    if (new Date(checkIn).getTime() <= Date.now()) {
      setError(translate(locale, 'search.intervalMustBeFuture'));
      return;
    }
    const state: BookingSearchState = {
      checkIn,
      checkOut,
      adults: submittedAdults,
      children: submittedChildren,
    };
    setError(undefined);
    if (onSearch !== undefined) {
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
      {embedded ? null : (
        <header className="availability-page__intro">
          <h1>{translate(locale, 'search.heading')}</h1>
          <p>{translate(locale, 'search.description')}</p>
        </header>
      )}
      <form aria-busy={!isHydrated} className="availability-search" noValidate onSubmit={submit}>
        <FieldGroup className="availability-search__fields" role="group">
          <Field>
            <FieldLabel htmlFor="availability-check-in-date">
              {translate(locale, 'search.checkIn')}
            </FieldLabel>
            <Input
              data-testid="availability-check-in-date"
              disabled={!isHydrated}
              id="availability-check-in-date"
              onChange={(event) => {
                const next = event.target.value;
                setCheckInDate(next);
                if (checkOutDate === '' || checkOutDate < next) setCheckOutDate(nextDay(next));
              }}
              required
              type="date"
              value={checkInDate}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="availability-check-in-time">
              {translate(locale, 'search.checkInTime')}
            </FieldLabel>
            <Input
              data-testid="availability-check-in-time"
              disabled={!isHydrated}
              id="availability-check-in-time"
              onChange={(event) => setCheckInTime(event.target.value)}
              required
              step={900}
              type="time"
              value={checkInTime}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="availability-check-out-date">
              {translate(locale, 'search.checkOutDate')}
            </FieldLabel>
            <Input
              data-testid="availability-check-out-date"
              disabled={!isHydrated}
              id="availability-check-out-date"
              min={checkInDate || undefined}
              onChange={(event) => setCheckOutDate(event.target.value)}
              required
              type="date"
              value={checkOutDate}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="availability-check-out-time">
              {translate(locale, 'search.checkOutTime')}
            </FieldLabel>
            <Input
              data-testid="availability-check-out-time"
              disabled={!isHydrated}
              id="availability-check-out-time"
              onChange={(event) => setCheckOutTime(event.target.value)}
              required
              step={900}
              type="time"
              value={checkOutTime}
            />
          </Field>
        </FieldGroup>
        <FieldGroup className="availability-search__fields availability-search__fields--guests">
          <Field>
            <FieldLabel htmlFor="availability-adults">
              {translate(locale, 'search.adults')}
            </FieldLabel>
            <Input
              data-testid="availability-adults"
              disabled={!isHydrated}
              id="availability-adults"
              min="1"
              onChange={(event) => setAdults(event.target.value)}
              required
              type="number"
              value={adults}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="availability-children">
              {translate(locale, 'search.children')}
            </FieldLabel>
            <Input
              data-testid="availability-children"
              disabled={!isHydrated}
              id="availability-children"
              min="0"
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
        {error === undefined ? null : (
          <Alert variant="destructive">
            <AlertTitle>{translate(locale, 'search.error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </form>
    </section>
  );
}

export { FIVE_MINUTE_MS };
