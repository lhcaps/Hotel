'use client';

import { useEffect, useRef, useState } from 'react';

import type { AvailabilitySearchResponse, NearbyAvailabilityResponse } from '@room/contracts';

import { publicApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import type { BookingSearchState } from '../lib/booking-search-state';
import { AvailabilitySearchForm } from './availability-search-form';
import { AvailabilitySearchResults, type NearbyStatus } from './availability-search-results';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

type ExactStatus = 'idle' | 'loading' | 'success' | 'empty' | 'unavailable' | 'error';

export function LandingAvailabilitySearch() {
  const [state, setState] = useState<BookingSearchState>();
  const [exactStatus, setExactStatus] = useState<ExactStatus>('idle');
  const [exactResponse, setExactResponse] = useState<AvailabilitySearchResponse>();
  const [exactError, setExactError] = useState<unknown>();
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>('idle');
  const [nearbyResponse, setNearbyResponse] = useState<NearbyAvailabilityResponse>();
  const [nearbyError, setNearbyError] = useState<unknown>();
  const resultsRef = useRef<HTMLDivElement>(null);

  async function searchExact(nextState: BookingSearchState) {
    setState(nextState);
    setExactStatus('loading');
    setExactResponse(undefined);
    setExactError(undefined);
    setNearbyStatus('idle');
    setNearbyResponse(undefined);
    setNearbyError(undefined);
    try {
      const nextResponse = await publicApi.searchAvailability({
        mode: nextState.mode,
        checkIn: nextState.checkIn,
        checkOut: nextState.checkOut,
        adults: nextState.adults,
        children: nextState.children,
      });
      setExactResponse(nextResponse);
      setExactStatus(
        nextResponse.state === 'PRICING_CONFIGURATION_UNAVAILABLE' ||
          nextResponse.state === 'CATALOG_UNAVAILABLE' ||
          nextResponse.state === 'INVALID_INTERVAL' ||
          nextResponse.state === 'BELOW_MINIMUM_STAY' ||
          nextResponse.state === 'ABOVE_MAXIMUM_STAY' ||
          nextResponse.state === 'INVALID_GUEST_COUNT' ||
          nextResponse.state === 'NO_CONTINUOUS_ROOM' ||
          nextResponse.state === 'NO_VALID_PRICING' ||
          nextResponse.state === 'POLICY_NOT_CONFIGURED' ||
          nextResponse.state === 'SERVICE_UNAVAILABLE'
          ? 'unavailable'
          : nextResponse.items.length === 0
            ? 'empty'
            : 'success',
      );
    } catch (cause) {
      setExactError(cause);
      setExactStatus('error');
    }
  }

  async function searchNearby(nextState: BookingSearchState) {
    setNearbyStatus('loading');
    setNearbyError(undefined);
    try {
      const nextResponse = await publicApi.searchNearbyAvailability({
        mode: nextState.mode,
        checkIn: nextState.checkIn,
        checkOut: nextState.checkOut,
        adults: nextState.adults,
        children: nextState.children,
        expandMinutes: 60,
        limit: 6,
      });
      setNearbyResponse(nextResponse);
      setNearbyStatus(nextResponse.candidates.length === 0 ? 'empty' : 'success');
    } catch (cause) {
      setNearbyError(cause);
      setNearbyStatus('error');
    }
  }

  useEffect(() => {
    if (exactStatus !== 'empty' || !state) return;
    void searchNearby(state);
    // We intentionally depend only on the exact-empty transition; once a
    // successful exact search resumes, the nearby request is dropped.
  }, [exactStatus, state]);

  useEffect(() => {
    if (exactStatus !== 'success' && exactStatus !== 'empty') return;
    const target = resultsRef.current?.querySelector<HTMLElement>('#availability-results-heading');
    if (target && 'scrollIntoView' in target) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    target?.focus({ preventScroll: true });
  }, [exactStatus]);

  if (exactStatus === 'idle' || !state) {
    return (
      <div className="landing-availability-search" data-slot="landing-availability-search">
        <AvailabilitySearchForm
          embedded
          onSearch={(nextState) => void searchExact(nextState)}
          variant="home"
        />
      </div>
    );
  }

  return (
    <div className="landing-availability-search" data-slot="landing-availability-search">
      <AvailabilitySearchForm
        embedded
        onSearch={(nextState) => void searchExact(nextState)}
        variant="home"
      />
      <div aria-live="polite" className="landing-availability-search__results" ref={resultsRef}>
        <AvailabilitySearchResults
          {...(exactResponse !== undefined ? { exactResponse } : {})}
          exactStatus={exactStatus}
          {...(exactError !== undefined ? { exactError } : {})}
          nearbyError={nearbyError}
          {...(nearbyResponse !== undefined ? { nearbyResponse } : {})}
          nearbyStatus={nearbyStatus}
          onRetry={() => void searchExact(state)}
          onRetryNearby={() => void searchNearby(state)}
          showFullResultsLink
          state={state}
        />
      </div>
    </div>
  );
}

export function CustomerSessionNotice() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Customer session detected</AlertTitle>
      <AlertDescription>{translate(undefined as never, 'search.emptyHelp')}</AlertDescription>
    </Alert>
  );
}
