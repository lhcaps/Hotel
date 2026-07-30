'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import type {
  AvailabilitySearchResponse,
  NearbyAvailabilityCandidate,
  NearbyAvailabilityResponse,
} from '@room/contracts';

import { publicApi } from '../lib/admin-api';
import { formatDateTime, formatVnd, translate } from '../lib/i18n/messages';
import {
  readBookingSearchQuery,
  toBookingSearchQuery,
  type BookingSearchState,
} from '../lib/booking-search-state';
import { publicRoomImage } from '../lib/public-room-catalog';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from './ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './ui/empty';
import { Skeleton } from './ui/skeleton';
import { useLocale } from './locale-provider';

export type ExactStatus = 'error' | 'loading' | 'success' | 'empty';

export type NearbyStatus = 'idle' | 'error' | 'loading' | 'success' | 'empty';

export function AvailabilitySearchResults({
  state: controlledState,
  exactStatus: controlledExactStatus,
  exactResponse: controlledExactResponse,
  nearbyStatus: controlledNearbyStatus,
  nearbyResponse: controlledNearbyResponse,
  nearbyError,
  nearbyFetchId: _nearbyFetchId,
  onRetry,
  onRetryNearby,
  showFullResultsLink = false,
}: Readonly<{
  state?: BookingSearchState;
  exactStatus?: ExactStatus;
  exactResponse?: AvailabilitySearchResponse;
  nearbyStatus?: NearbyStatus;
  nearbyResponse?: NearbyAvailabilityResponse;
  nearbyError?: unknown;
  nearbyFetchId?: string;
  onRetry?: () => void;
  onRetryNearby?: () => void;
  showFullResultsLink?: boolean;
}>) {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const queryState = readBookingSearchQuery(searchParams);
  const state = controlledState ?? queryState;
  const [exactResponse, setExactResponse] = useState<AvailabilitySearchResponse>();
  const [exactFetchFailed, setExactFetchFailed] = useState(false);
  const isControlled = controlledState !== undefined;
  const items = (controlledExactResponse ?? exactResponse)?.items;
  const exactStatus: ExactStatus | undefined = isControlled
    ? controlledExactStatus
    : exactFetchFailed
      ? 'error'
      : items
        ? items.length === 0
          ? 'empty'
          : 'success'
        : state
          ? 'loading'
          : undefined;

  useEffect(() => {
    if (isControlled || !state) return;
    let active = true;
    setExactResponse(undefined);
    setExactFetchFailed(false);
    void publicApi
      .searchAvailability({
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        adults: state.adults,
        children: state.children,
      })
      .then((nextResponse) => active && setExactResponse(nextResponse))
      .catch(() => active && setExactFetchFailed(true));
    return () => {
      active = false;
    };
  }, [isControlled, state?.checkIn, state?.checkOut, state?.adults, state?.children, state?.mode]);

  if (!state) {
    return (
      <Empty className="availability-empty" data-slot="empty">
        <EmptyHeader>
          <EmptyTitle>{translate(locale, 'search.emptyTitle')}</EmptyTitle>
          <EmptyDescription>{translate(locale, 'search.emptyHelp')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (exactStatus === 'error') {
    return (
      <Alert className="availability-results__error" variant="destructive">
        <AlertTitle>{translate(locale, 'search.loadErrorTitle')}</AlertTitle>
        <AlertDescription>{translate(locale, 'search.loadErrorHelp')}</AlertDescription>
        {onRetry ? (
          <Button onClick={onRetry} size="sm" type="button">
            {translate(locale, 'search.retry')}
          </Button>
        ) : null}
      </Alert>
    );
  }

  if (exactStatus === 'loading') {
    return (
      <div aria-busy="true" className="availability-results" data-testid="availability-loading">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (exactStatus === 'success' && items) {
    const totalAvailableRooms = items.reduce(
      (sum, item) => sum + (item.availableRoomCount > 0 ? item.availableRoomCount : 0),
      0,
    );
    return (
      <section aria-label={translate(locale, 'search.results')} className="availability-results">
        <header id="availability-results-heading" tabIndex={-1}>
          <p>{translate(locale, 'search.selectedInterval')}</p>
          <h2>{translate(locale, 'search.results')}</h2>
          <p>
            {translate(locale, 'search.totalMatchingRoomTypes', { count: items.length })} ·{' '}
            {translate(locale, 'search.totalAvailableRooms', { count: totalAvailableRooms })}
          </p>
          {showFullResultsLink ? (
            <Link href={`/booking/search?${toBookingSearchQuery(state)}`}>
              {translate(locale, 'search.openFullResults')}
            </Link>
          ) : null}
        </header>
        <div className="availability-results__grid">
          {items.map((room) => (
            <ResultCard
              badge={translate(locale, 'search.nearbyExact')}
              badgeVariant="exact"
              imageSrc={publicRoomImage(room.roomTypeId)}
              key={room.roomTypeId}
              roomTypeId={room.roomTypeId}
              roomTypeName={room.roomTypeName}
              state={state}
              amenities={room.amenities}
              availableRoomCount={room.availableRoomCount}
              maxOccupancy={room.maxOccupancy}
              {...(room.offer !== undefined ? { offer: room.offer } : {})}
            />
          ))}
        </div>
      </section>
    );
  }

  // exactStatus === 'empty'
  return (
    <NearbySection
      locale={locale}
      {...(nearbyError !== undefined ? { nearbyError } : {})}
      {...(controlledNearbyResponse !== undefined
        ? { nearbyResponse: controlledNearbyResponse }
        : {})}
      nearbyStatus={controlledNearbyStatus ?? 'idle'}
      {...(onRetryNearby !== undefined ? { onRetryNearby } : {})}
      state={state}
    />
  );
}

function ResultCard({
  roomTypeId,
  roomTypeName,
  description,
  amenities,
  availableRoomCount,
  maxOccupancy,
  offer,
  imageSrc,
  state,
  badge,
  badgeVariant,
}: Readonly<{
  roomTypeId: string;
  roomTypeName: string;
  description?: string | null;
  amenities: string[];
  availableRoomCount: number;
  maxOccupancy: number;
  offer?: { planLabel: string; amountVnd: number } | null;
  imageSrc: string;
  state: BookingSearchState;
  badge: string;
  badgeVariant: 'exact' | 'nearby';
}>) {
  const locale = useLocale();
  const status =
    availableRoomCount > 1
      ? translate(locale, 'search.available')
      : availableRoomCount === 1
        ? translate(locale, 'search.lowAvailability')
        : translate(locale, 'search.soldOut');
  return (
    <Card className="availability-results__room" data-testid={`availability-room-${roomTypeId}`}>
      <img alt="" className="availability-results__room-image" src={imageSrc} />
      <CardHeader>
        <div className="availability-results__badges">
          <Badge variant={badgeVariant === 'exact' ? 'secondary' : 'outline'}>{badge}</Badge>
          <Badge variant={availableRoomCount > 0 ? 'secondary' : 'destructive'}>{status}</Badge>
        </div>
        <h3>{roomTypeName}</h3>
        <CardDescription>
          {translate(locale, 'search.capacity', { count: maxOccupancy })} ·{' '}
          {translate(
            locale,
            state.mode === 'hourly' ? 'search.modeHourly' : 'search.modeOvernight',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="availability-results__room-content">
        {description !== null ? <p>{description}</p> : null}
        <p>
          {availableRoomCount > 0
            ? translate(locale, 'search.availableCount', { count: availableRoomCount })
            : translate(locale, 'search.changeTime')}
        </p>
        {amenities.length > 0 ? (
          <ul
            aria-label={translate(locale, 'catalog.amenities')}
            className="availability-results__amenities"
          >
            {amenities.slice(0, 3).map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>
        ) : null}
        {offer ? (
          <p className="availability-results__offer">
            <span>{offer.planLabel}</span>
            <strong>
              {translate(locale, 'search.fromPrice', {
                amount: formatVnd(locale, offer.amountVnd),
              })}
            </strong>
          </p>
        ) : availableRoomCount > 0 ? (
          <p className="availability-results__no-offer">{translate(locale, 'search.noOffer')}</p>
        ) : null}
      </CardContent>
      <CardFooter className="availability-results__room-footer">
        {availableRoomCount > 0 && offer ? (
          <Link
            className="hospitality-button"
            href={`/rooms/${roomTypeId}?${toBookingSearchQuery(state)}`}
          >
            {translate(locale, 'search.viewRoomAndPrice')}
          </Link>
        ) : (
          <Link href="/#booking">{translate(locale, 'search.checkOtherDate')}</Link>
        )}
      </CardFooter>
    </Card>
  );
}

function NearbySection({
  state,
  nearbyStatus,
  nearbyResponse,
  nearbyError,
  onRetryNearby,
  locale,
}: Readonly<{
  state: BookingSearchState;
  nearbyStatus: NearbyStatus;
  nearbyResponse?: NearbyAvailabilityResponse;
  nearbyError?: unknown;
  onRetryNearby?: () => void;
  locale: ReturnType<typeof useLocale>;
}>) {
  void nearbyError;
  return (
    <section
      aria-label={translate(locale, 'search.nearbyHeading')}
      className="availability-results availability-results--nearby"
      data-testid="availability-nearby"
    >
      <header id="availability-results-heading" tabIndex={-1}>
        <Empty className="availability-empty availability-empty--inline">
          <EmptyHeader>
            <EmptyTitle>{translate(locale, 'search.noMatchTitle')}</EmptyTitle>
            <EmptyDescription>{translate(locale, 'search.noMatchHelp')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <h2>{translate(locale, 'search.nearbyHeading')}</h2>
      </header>
      {nearbyStatus === 'loading' ? (
        <div aria-busy="true" className="availability-results__grid">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {nearbyStatus === 'error' ? (
        <Alert variant="destructive">
          <AlertTitle>{translate(locale, 'search.nearbyErrorTitle')}</AlertTitle>
          <AlertDescription>
            {translate(locale, 'search.nearbyErrorHelp')}
            {onRetryNearby ? (
              <Button className="margin-top-sm" onClick={onRetryNearby} size="sm" type="button">
                {translate(locale, 'search.retry')}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {nearbyStatus === 'empty' ? (
        <Empty className="availability-empty">
          <EmptyHeader>
            <EmptyTitle>{translate(locale, 'search.nearbyEmptyTitle')}</EmptyTitle>
            <EmptyDescription>{translate(locale, 'search.nearbyEmptyHelp')}</EmptyDescription>
          </EmptyHeader>
          <Link href="/#booking">{translate(locale, 'search.browseAllRoomTypes')}</Link>
        </Empty>
      ) : null}
      {nearbyStatus === 'success' && nearbyResponse ? (
        <div className="availability-results__nearby-groups">
          {nearbyResponse.candidates.map((candidate) => (
            <NearbyCandidateGroup
              candidate={candidate}
              key={`${candidate.checkIn}-${candidate.checkOut}`}
              state={state}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function NearbyCandidateGroup({
  candidate,
  state,
}: Readonly<{
  candidate: NearbyAvailabilityCandidate;
  state: BookingSearchState;
}>) {
  const locale = useLocale();
  const isExact = candidate.shiftMinutes === 0;
  const intervalState: BookingSearchState = {
    mode: state.mode,
    checkIn: candidate.checkIn,
    checkOut: candidate.checkOut,
    adults: state.adults,
    children: state.children,
  };
  return (
    <article
      className="availability-results__nearby-group"
      data-testid={`nearby-candidate-${candidate.checkIn}`}
    >
      <header>
        <h3>
          {isExact
            ? translate(locale, 'search.nearbyExact')
            : translate(locale, 'search.nearbyShift', { minutes: candidate.shiftMinutes })}
        </h3>
        <p>
          {formatDateTime(locale, candidate.checkIn)} – {formatDateTime(locale, candidate.checkOut)}
        </p>
      </header>
      <div className="availability-results__grid">
        {candidate.roomTypes.map((room) => (
          <ResultCard
            badge={
              isExact
                ? translate(locale, 'search.nearbyExact')
                : translate(locale, 'search.nearbyShift', { minutes: candidate.shiftMinutes })
            }
            badgeVariant="nearby"
            imageSrc={publicRoomImage(room.roomTypeId)}
            key={room.roomTypeId}
            roomTypeId={room.roomTypeId}
            roomTypeName={room.roomTypeName}
            state={intervalState}
            {...(room.description !== undefined ? { description: room.description } : {})}
            amenities={room.amenities}
            availableRoomCount={room.availableRoomCount}
            maxOccupancy={room.maxOccupancy}
            {...(room.offer !== undefined ? { offer: room.offer } : {})}
          />
        ))}
      </div>
    </article>
  );
}
