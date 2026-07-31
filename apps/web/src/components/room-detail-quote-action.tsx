'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { publicApi } from '../lib/admin-api';
import { readBookingSearchQuery } from '../lib/booking-search-state';
import { formatVnd, translate, translatePlanLabel } from '../lib/i18n/messages';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { useLocale } from './locale-provider';

export function RoomDetailQuoteAction({
  roomTypeId,
  search,
}: Readonly<{ roomTypeId: string; search: string }>) {
  const router = useRouter();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offers, setOffers] = useState<
    Awaited<ReturnType<typeof publicApi.eligibleOffers>> | undefined
  >();
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>();
  const state = readBookingSearchQuery(new URLSearchParams(search));

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    setFailed(false);
    setOffers(undefined);
    void publicApi
      .eligibleOffers({
        roomTypeId,
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        adults: state.adults,
        children: state.children,
      })
      .then((result) => {
        if (cancelled) return;
        setOffers(result);
        setSelectedPlanCode(result.items[0]?.planCode);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [roomTypeId, state?.adults, state?.checkIn, state?.checkOut, state?.children]);

  async function issueQuote() {
    if (!state || pending || !selectedPlanCode) return;
    setPending(true);
    setFailed(false);
    try {
      const quote = await publicApi.issueQuote({
        roomTypeId,
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        adults: state.adults,
        children: state.children,
        selectedPlanCode,
      });
      const params = new URLSearchParams(search);
      params.set('selectedPlanCode', selectedPlanCode);
      router.push(`/booking/quote/${quote.id}?roomTypeId=${roomTypeId}&${params.toString()}`);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  if (!state) return null;
  return (
    <div className="flex flex-col gap-3">
      {offers === undefined && !failed ? <Skeleton className="h-32 w-full" /> : null}
      {offers?.items.length === 0 ? (
        <Alert>
          <AlertTitle>{translate(locale, 'catalog.quoteUnavailable')}</AlertTitle>
          <AlertDescription>{translate(locale, 'catalog.quoteUnavailableHelp')}</AlertDescription>
        </Alert>
      ) : null}
      {offers?.items.map((offer) => (
        <button
          aria-pressed={selectedPlanCode === offer.planCode}
          className="rounded-md border p-4 text-left"
          data-plan-code={offer.planCode}
          data-testid="room-detail-plan"
          key={offer.planCode}
          onClick={() => setSelectedPlanCode(offer.planCode)}
          type="button"
        >
          <strong>{translatePlanLabel(locale, offer.planCode)}</strong>
          <span className="block text-sm">
            {translate(locale, 'ratePlan.includeDuration', {
              minutes: offer.includedDurationMinutes,
            })}
            {offer.extraUnits > 0
              ? `, ${translate(locale, 'ratePlan.extraHourCopy', { count: offer.extraUnits })}`
              : ''}
          </span>
          <span className="block text-sm">{formatVnd(locale, offer.totalAmountVnd)}</span>
        </button>
      ))}
      {offers !== undefined && offers.items.length > 0 ? (
        pending ? (
          <Skeleton className="h-11 w-48" />
        ) : (
          <Button onClick={() => void issueQuote()} size="lg">
            {translate(locale, 'catalog.viewQuote')}
          </Button>
        )
      ) : null}
      {failed ? (
        <Alert variant="destructive">
          <AlertTitle>{translate(locale, 'catalog.quoteUnavailable')}</AlertTitle>
          <AlertDescription>{translate(locale, 'catalog.quoteUnavailableHelp')}</AlertDescription>
          <Button onClick={() => globalThis.location.reload()} size="sm" type="button">
            {translate(locale, 'recommendations.retry')}
          </Button>
        </Alert>
      ) : null}
    </div>
  );
}
