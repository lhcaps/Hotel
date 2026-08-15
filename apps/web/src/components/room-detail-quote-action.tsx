'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { ProblemDetails } from '@room/contracts';

import { AdminApiError, publicApi } from '../lib/admin-api';
import { readBookingSearchQuery } from '../lib/booking-search-state';
import {
  formatVnd,
  translate,
  translatePlanLabel,
  type Locale,
  type MessageKey,
} from '../lib/i18n/messages';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { useLocale } from './locale-provider';

type QuoteFieldError = 'interval' | 'adults' | 'children' | 'roomTypeId' | 'unknown';

interface QuoteErrorState {
  readonly kind: 'field' | 'availability' | 'system';
  readonly field?: QuoteFieldError;
  readonly requestId?: string;
}

interface QuoteErrorDescription {
  readonly variant: 'default' | 'destructive';
  readonly title: string;
  readonly help: string;
}

function fieldFromProblem(problem: ProblemDetails): QuoteFieldError {
  const fields = problem.errors?.map((issue) => issue.field) ?? [];
  if (fields.includes('roomTypeId')) return 'roomTypeId';
  if (fields.includes('adults')) return 'adults';
  if (fields.includes('children')) return 'children';
  if (fields.includes('checkIn') || fields.includes('checkOut')) return 'interval';
  return 'unknown';
}

function fieldKey(field: QuoteFieldError): MessageKey {
  switch (field) {
    case 'interval':
      return 'catalog.quoteErrorIntervalField';
    case 'adults':
      return 'catalog.quoteErrorAdultsField';
    case 'children':
      return 'catalog.quoteErrorChildrenField';
    case 'roomTypeId':
      return 'catalog.quoteErrorRoomTypeField';
    case 'unknown':
    default:
      return 'catalog.quoteErrorGeneric';
  }
}

function describeQuoteError(locale: Locale, error: unknown): QuoteErrorDescription {
  if (error instanceof AdminApiError) {
    const problem = error.problem;
    const code = problem.code;
    if (
      code === 'VALIDATION_ERROR' ||
      code === 'INVALID_PRICING_INTERVAL' ||
      code === 'OVERNIGHT_ONE_NIGHT' ||
      code === 'BELOW_MINIMUM_STAY' ||
      code === 'ABOVE_MAXIMUM_STAY'
    ) {
      const field = fieldFromProblem(problem);
      return {
        variant: 'default',
        title: translate(locale, fieldKey(field)),
        help: translate(locale, 'search.invalidIntervalErrorHelp'),
      };
    }
    if (
      code === 'AVAILABILITY_UNAVAILABLE' ||
      code === 'NO_CONTINUOUS_ROOM' ||
      code === 'NO_VALID_PRICING' ||
      code === 'PRICING_CONFIGURATION_UNAVAILABLE' ||
      code === 'POLICY_NOT_CONFIGURED' ||
      code === 'SERVICE_UNAVAILABLE' ||
      code === 'CATALOG_UNAVAILABLE' ||
      code === 'INVALID_INTERVAL' ||
      code === 'INVALID_GUEST_COUNT'
    ) {
      return {
        variant: 'default',
        title: translate(locale, 'catalog.quoteSoldOutTitle'),
        help: translate(locale, 'catalog.quoteSoldOutHelp'),
      };
    }
    return {
      variant: 'destructive',
      title: translate(locale, 'catalog.quoteSystemErrorTitle'),
      help: translate(locale, 'catalog.quoteSystemErrorHelp'),
    };
  }
  return {
    variant: 'destructive',
    title: translate(locale, 'catalog.quoteSystemErrorTitle'),
    help: translate(locale, 'catalog.quoteSystemErrorHelp'),
  };
}

function captureProblem(error: unknown): QuoteErrorState | undefined {
  if (!(error instanceof AdminApiError)) {
    return { kind: 'system' };
  }
  const problem = error.problem;
  const code = problem.code;
  if (
    code === 'VALIDATION_ERROR' ||
    code === 'INVALID_PRICING_INTERVAL' ||
    code === 'OVERNIGHT_ONE_NIGHT' ||
    code === 'BELOW_MINIMUM_STAY' ||
    code === 'ABOVE_MAXIMUM_STAY'
  ) {
    return {
      kind: 'field',
      field: fieldFromProblem(problem),
      ...(problem.requestId !== undefined ? { requestId: problem.requestId } : {}),
    };
  }
  if (
    code === 'AVAILABILITY_UNAVAILABLE' ||
    code === 'NO_CONTINUOUS_ROOM' ||
    code === 'NO_VALID_PRICING' ||
    code === 'PRICING_CONFIGURATION_UNAVAILABLE' ||
    code === 'POLICY_NOT_CONFIGURED' ||
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'CATALOG_UNAVAILABLE' ||
    code === 'INVALID_INTERVAL' ||
    code === 'INVALID_GUEST_COUNT'
  ) {
    return { kind: 'availability' };
  }
  return {
    kind: 'system',
    ...(problem.requestId !== undefined ? { requestId: problem.requestId } : {}),
  };
}

export function RoomDetailQuoteAction({
  roomTypeId,
  search,
}: Readonly<{ roomTypeId: string; search: string }>) {
  const router = useRouter();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [quoteError, setQuoteError] = useState<unknown>(undefined);
  const [offers, setOffers] = useState<
    Awaited<ReturnType<typeof publicApi.eligibleOffers>> | undefined
  >();
  const state = readBookingSearchQuery(new URLSearchParams(search));

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    setQuoteError(undefined);
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
      .catch((cause: unknown) => {
        if (cancelled) return;
        setQuoteError(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [roomTypeId, state?.adults, state?.checkIn, state?.checkOut, state?.children]);

  async function issueQuote() {
    if (!state || pending) return;
    setPending(true);
    setQuoteError(undefined);
    try {
      const quote = await publicApi.issueQuote({
        roomTypeId,
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        adults: state.adults,
        children: state.children,
      });
      router.push(`/booking/quote/${quote.id}?roomTypeId=${roomTypeId}&${search}`);
    } catch (cause: unknown) {
      setQuoteError(cause);
    } finally {
      setPending(false);
    }
  }

  const errorDescription =
    quoteError === undefined ? undefined : describeQuoteError(locale, quoteError);
  const captured = quoteError === undefined ? undefined : captureProblem(quoteError);

  if (!state) return null;
  return (
    <div className="flex flex-col gap-3">
      {offers === undefined && quoteError === undefined ? (
        <Skeleton className="h-32 w-full" />
      ) : null}
      {offers?.items.length === 0 && quoteError === undefined ? (
        <Alert>
          <AlertTitle>{translate(locale, 'catalog.quoteUnavailable')}</AlertTitle>
          <AlertDescription>{translate(locale, 'catalog.quoteUnavailableHelp')}</AlertDescription>
        </Alert>
      ) : null}
      {offers !== undefined && offers.items.length > 0 && quoteError === undefined ? (
        offers.items[0] === undefined ? null : (
          <>
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
              <span className="block text-sm">
                {formatVnd(locale, offers.items[0].totalAmountVnd)}
              </span>
            </div>
            {pending ? (
              <Skeleton className="h-11 w-48" />
            ) : (
              <Button onClick={() => void issueQuote()} size="lg">
                {translate(locale, 'catalog.viewQuote')}
              </Button>
            )}
          </>
        )
      ) : null}
      {quoteError !== undefined && errorDescription !== undefined && captured !== undefined ? (
        <Alert
          data-testid={`room-detail-quote-error-${captured.kind}`}
          variant={errorDescription.variant}
        >
          <AlertTitle>{errorDescription.title}</AlertTitle>
          <AlertDescription>
            {errorDescription.help}
            {captured.kind === 'availability' ? (
              <>
                {' '}
                <a className="underline" href={`/booking/search?${search}`}>
                  {translate(locale, 'search.checkOtherDate')}
                </a>
              </>
            ) : null}
          </AlertDescription>
          {captured.kind !== 'availability' ? (
            <Button onClick={() => globalThis.location.reload()} size="sm" type="button">
              {translate(locale, 'recommendations.retry')}
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
