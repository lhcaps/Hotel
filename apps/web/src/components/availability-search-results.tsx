'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import type {
  AvailabilitySearchResponse,
  NearbyAvailabilityCandidate,
  NearbyAvailabilityResponse,
} from '@room/contracts';

import { AdminApiError, publicApi } from '../lib/admin-api';
import { formatDateTime, formatVnd, translate, type Locale } from '../lib/i18n/messages';
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

export type ExactStatus = 'error' | 'loading' | 'success' | 'empty' | 'unavailable';

export type NearbyStatus = 'idle' | 'error' | 'loading' | 'success' | 'empty';

const INVALID_INTERVAL_CODES = new Set([
  'VALIDATION_ERROR',
  'INVALID_PRICING_INTERVAL',
  'OVERNIGHT_ONE_NIGHT',
  'BELOW_MINIMUM_STAY',
  'ABOVE_MAXIMUM_STAY',
  'INVALID_GUEST_COUNT',
]);
const PRICING_UNAVAILABLE_CODES = new Set([
  'PRICING_CONFIGURATION_UNAVAILABLE',
  'PRICING_RULE_NOT_FOUND',
  'PRICING_RULE_AMBIGUOUS',
  'PRICING_RULE_INVALID',
  'PRICING_PRICE_MISSING',
  'PRICING_EXTRA_PRICE_MISSING',
  'NO_VALID_PRICING',
  'POLICY_NOT_CONFIGURED',
  'SERVICE_UNAVAILABLE',
]);

interface AvailabilityErrorFallback {
  readonly titleKey: 'search.loadErrorTitle' | 'search.nearbyErrorTitle';
  readonly helpKey: 'search.loadErrorHelp' | 'search.nearbyErrorHelp';
}

function describeAvailabilityError(
  locale: Locale,
  error: unknown,
  fallback: AvailabilityErrorFallback = {
    titleKey: 'search.loadErrorTitle',
    helpKey: 'search.loadErrorHelp',
  },
): { readonly title: string; readonly help: string } {
  const code =
    error instanceof AdminApiError ? (error.problem as { code?: string }).code : undefined;
  if (code !== undefined && INVALID_INTERVAL_CODES.has(code)) {
    if (code === 'OVERNIGHT_ONE_NIGHT') {
      return {
        title: translate(locale, 'search.overnightOneNightTitle'),
        help: translate(locale, 'search.overnightOneNightHelp'),
      };
    }
    return {
      title: translate(locale, 'search.invalidIntervalErrorTitle'),
      help: translate(locale, 'search.invalidIntervalErrorHelp'),
    };
  }
  if (code !== undefined && PRICING_UNAVAILABLE_CODES.has(code)) {
    return {
      title: translate(locale, 'search.pricingUnavailableErrorTitle'),
      help: translate(locale, 'search.pricingUnavailableErrorHelp'),
    };
  }
  return {
    title: translate(locale, fallback.titleKey),
    help: translate(locale, fallback.helpKey),
  };
}

function responseStateCopy(
  locale: Locale,
  state: string | undefined,
): { readonly title: string; readonly help: string } {
  switch (state) {
    case 'BELOW_MINIMUM_STAY':
      return {
        title: translate(locale, 'search.belowMinimumStayTitle'),
        help: translate(locale, 'search.belowMinimumStayHelp'),
      };
    case 'ABOVE_MAXIMUM_STAY':
      return {
        title: translate(locale, 'search.aboveMaximumStayTitle'),
        help: translate(locale, 'search.aboveMaximumStayHelp'),
      };
    case 'INVALID_GUEST_COUNT':
      return {
        title: translate(locale, 'search.invalidGuestCountTitle'),
        help: translate(locale, 'search.invalidGuestCountHelp'),
      };
    case 'NO_CONTINUOUS_ROOM':
      return {
        title: translate(locale, 'search.noContinuousRoomTitle'),
        help: translate(locale, 'search.noContinuousRoomHelp'),
      };
    case 'INVALID_INTERVAL':
      return {
        title: translate(locale, 'search.invalidIntervalErrorTitle'),
        help: translate(locale, 'search.invalidIntervalErrorHelp'),
      };
    case 'NO_VALID_PRICING':
    case 'POLICY_NOT_CONFIGURED':
      return {
        title: translate(locale, 'search.pricingUnavailableErrorTitle'),
        help: translate(locale, 'search.pricingUnavailableErrorHelp'),
      };
    default:
      return {
        title: translate(locale, 'search.loadErrorTitle'),
        help: translate(locale, 'search.loadErrorHelp'),
      };
  }
}

export function AvailabilitySearchResults({
  state: controlledState,
  exactStatus: controlledExactStatus,
  exactResponse: controlledExactResponse,
  exactError: controlledExactError,
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
  exactError?: unknown;
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
  const [exactFetchError, setExactFetchError] = useState<unknown>();
  const isControlled = controlledState !== undefined;
  const items = (controlledExactResponse ?? exactResponse)?.items;
  const responseState = (controlledExactResponse ?? exactResponse)?.state;
  const exactStatus: ExactStatus | undefined = isControlled
    ? controlledExactStatus
    : exactFetchError !== undefined
      ? 'error'
      : responseState === 'PRICING_CONFIGURATION_UNAVAILABLE' ||
          responseState === 'CATALOG_UNAVAILABLE' ||
          responseState === 'INVALID_INTERVAL' ||
          responseState === 'BELOW_MINIMUM_STAY' ||
          responseState === 'ABOVE_MAXIMUM_STAY' ||
          responseState === 'INVALID_GUEST_COUNT' ||
          responseState === 'NO_CONTINUOUS_ROOM' ||
          responseState === 'NO_VALID_PRICING' ||
          responseState === 'POLICY_NOT_CONFIGURED' ||
          responseState === 'SERVICE_UNAVAILABLE'
        ? 'unavailable'
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
    setExactFetchError(undefined);
    void publicApi
      .searchAvailability({
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        adults: state.adults,
        children: state.children,
      })
      .then((nextResponse) => active && setExactResponse(nextResponse))
      .catch((cause: unknown) => active && setExactFetchError(cause));
    return () => {
      active = false;
    };
  }, [isControlled, state?.checkIn, state?.checkOut, state?.adults, state?.children]);

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
    const { title, help } = describeAvailabilityError(
      locale,
      isControlled ? controlledExactError : exactFetchError,
    );
    return (
      <Alert className="availability-results__error" variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{help}</AlertDescription>
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

  if (exactStatus === 'unavailable') {
    const unavailableState = (controlledExactResponse ?? exactResponse)?.state;
    const responseCopy = responseStateCopy(locale, unavailableState);
    return (
      <Alert className="availability-results__error" variant="destructive">
        <AlertTitle>{responseCopy.title}</AlertTitle>
        <AlertDescription>{responseCopy.help}</AlertDescription>
        {onRetry ? (
          <Button onClick={onRetry} size="sm" type="button">
            {translate(locale, 'search.retry')}
          </Button>
        ) : null}
      </Alert>
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
          {items.map((room) => {
            const imageSrc = publicRoomImage(room.roomTypeCode);
            return (
              <ResultCard
                badge={translate(locale, 'search.nearbyExact')}
                badgeVariant="exact"
                key={room.roomTypeId}
                roomTypeId={room.roomTypeId}
                roomTypeName={room.roomTypeName}
                {...(imageSrc === undefined ? {} : { imageSrc })}
                {...(room.propertyName === undefined ? {} : { propertyName: room.propertyName })}
                state={state}
                amenities={room.amenities}
                availableRoomCount={room.availableRoomCount}
                maxOccupancy={room.maxOccupancy}
                {...(room.offer !== undefined || room.offers !== undefined
                  ? { offer: room.offers?.[0] ?? room.offer }
                  : {})}
              />
            );
          })}
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
  propertyName,
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
  propertyName?: string;
  description?: string | null;
  amenities: string[];
  availableRoomCount: number;
  maxOccupancy: number;
  offer?: { planLabel: string; amountVnd: number } | null;
  imageSrc?: string;
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
      {imageSrc === undefined ? null : (
        <img alt="" className="availability-results__room-image" src={imageSrc} />
      )}
      <CardHeader>
        <div className="availability-results__badges">
          <Badge variant={badgeVariant === 'exact' ? 'secondary' : 'outline'}>{badge}</Badge>
          <Badge variant={availableRoomCount > 0 ? 'secondary' : 'destructive'}>{status}</Badge>
        </div>
        <h3>{roomTypeName}</h3>
        {propertyName === undefined ? null : <CardDescription>{propertyName}</CardDescription>}
        <CardDescription>
          {translate(locale, 'search.capacity', { count: maxOccupancy })} ·{' '}
          {formatDateTime(locale, state.checkIn)} – {formatDateTime(locale, state.checkOut)}
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
  const nearbyErrorDescription = describeAvailabilityError(locale, nearbyError, {
    titleKey: 'search.nearbyErrorTitle',
    helpKey: 'search.nearbyErrorHelp',
  });
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
          <AlertTitle>{nearbyErrorDescription.title}</AlertTitle>
          <AlertDescription>
            {nearbyErrorDescription.help}
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
        {candidate.roomTypes.map((room) => {
          const imageSrc = publicRoomImage(room.roomTypeCode);
          return (
            <ResultCard
              badge={
                isExact
                  ? translate(locale, 'search.nearbyExact')
                  : translate(locale, 'search.nearbyShift', { minutes: candidate.shiftMinutes })
              }
              badgeVariant="nearby"
              key={room.roomTypeId}
              roomTypeId={room.roomTypeId}
              roomTypeName={room.roomTypeName}
              {...(imageSrc === undefined ? {} : { imageSrc })}
              state={intervalState}
              {...(room.description !== undefined ? { description: room.description } : {})}
              amenities={room.amenities}
              availableRoomCount={room.availableRoomCount}
              maxOccupancy={room.maxOccupancy}
              {...(room.offer !== undefined || room.offers !== undefined
                ? { offer: room.offers?.[0] ?? room.offer }
                : {})}
            />
          );
        })}
      </div>
    </article>
  );
}
