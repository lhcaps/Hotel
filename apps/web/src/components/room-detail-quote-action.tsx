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
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [roomTypeId, state?.adults, state?.checkIn, state?.checkOut, state?.children]);

  async function issueQuote() {
    if (!state || pending) return;
    setPending(true);
    setFailed(false);
    try {
      const quote = await publicApi.issueQuote({
        roomTypeId,
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        adults: state.adults,
        children: state.children,
      });
      router.push(`/booking/quote/${quote.id}?roomTypeId=${roomTypeId}&${search}`);
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
      {offers?.items[0] === undefined ? null : (
        <div className="rounded-md border p-4" data-testid="room-detail-composed-price">
          <strong>{translatePlanLabel(locale, offers.items[0].planCode)}</strong>
          <span className="block text-sm">
            {offers.items[0].nightCount !== undefined
              ? `${offers.items[0].nightCount} ${translate(locale, 'quote.nightCount').toLowerCase()}`
              : translate(locale, 'ratePlan.includeDuration', {
                  minutes: offers.items[0].includedDurationMinutes,
                })}
            {offers.items[0].nightCount === undefined && offers.items[0].extraUnits > 0
              ? `, ${translate(locale, 'ratePlan.extraHourCopy', { count: offers.items[0].extraUnits })}`
              : ''}
          </span>
          <span className="block text-sm">{formatVnd(locale, offers.items[0].totalAmountVnd)}</span>
        </div>
      )}
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
