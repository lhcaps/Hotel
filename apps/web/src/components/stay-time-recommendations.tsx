'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { recommendationResponseSchema } from '@room/contracts/pricing';
import type { RecommendationResponse } from '@room/contracts';

import { publicApi } from '../lib/admin-api';
import {
  formatDateTime,
  formatVnd,
  translate,
  translatePlanLabel,
  type Locale,
} from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

interface RecommendationFormProps {
  readonly roomTypeId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
  readonly couponCode?: string;
  readonly selectedPlanCode?: string;
}

function describeShift(locale: Locale, shiftMinutes: number): string {
  if (shiftMinutes === 0) return translate(locale, 'recommendations.exactShift');
  return translate(locale, shiftMinutes > 0 ? 'recommendations.later' : 'recommendations.earlier', {
    minutes: Math.abs(shiftMinutes),
  });
}

function durationMinutes(checkIn: string, checkOut: string): number {
  return Math.max(
    0,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60_000),
  );
}

export function StayTimeRecommendations(props: RecommendationFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const [response, setResponse] = useState<RecommendationResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(true);
  const [applying, setApplying] = useState(false);

  const search = useCallback(async () => {
    setPending(true);
    setError(undefined);
    try {
      const result = await publicApi.searchStayTimeRecommendations({
        roomTypeId: props.roomTypeId,
        checkIn: props.checkIn,
        checkOut: props.checkOut,
        adults: props.adults,
        children: props.children,
        ...(props.couponCode !== undefined && props.couponCode !== ''
          ? { couponCode: props.couponCode }
          : {}),
      });
      setResponse(recommendationResponseSchema.parse(result));
    } catch {
      setResponse(undefined);
      setError(translate(locale, 'recommendations.searchError'));
    } finally {
      setPending(false);
    }
  }, [
    locale,
    props.adults,
    props.checkIn,
    props.checkOut,
    props.children,
    props.couponCode,
    props.roomTypeId,
  ]);

  useEffect(() => {
    void search();
  }, [search]);

  async function applyCandidate(checkIn: string, checkOut: string, recommendationPlanCode: string) {
    setApplying(true);
    setError(undefined);
    try {
      const body: {
        roomTypeId: string;
        checkIn: string;
        checkOut: string;
        adults: number;
        children: number;
        selectedPlanCode: string;
        couponCode?: string;
      } = {
        roomTypeId: props.roomTypeId,
        checkIn,
        checkOut,
        adults: props.adults,
        children: props.children,
        selectedPlanCode: recommendationPlanCode,
      };
      if (props.couponCode !== undefined && props.couponCode !== '') {
        body.couponCode = props.couponCode;
      }
      const result = await publicApi.issueQuote(body);
      const query = new URLSearchParams({
        roomTypeId: props.roomTypeId,
        checkIn,
        checkOut,
        adults: String(props.adults),
        children: String(props.children),
        selectedPlanCode: recommendationPlanCode,
      });
      router.push(`/booking/quote/${result.id}?${query.toString()}`);
    } catch {
      setError(translate(locale, 'recommendations.quoteError'));
      setApplying(false);
    }
  }

  return (
    <section
      aria-labelledby="stay-time-recommendations-heading"
      className="stay-time-recommendations"
    >
      <h2 id="stay-time-recommendations-heading" className="text-xl font-semibold">
        {translate(locale, 'recommendations.heading')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{translate(locale, 'recommendations.help')}</p>
      {pending ? (
        <p aria-live="polite" className="mt-4">
          {translate(locale, 'recommendations.searching')}
        </p>
      ) : null}
      {error ? (
        <div className="mt-4" role="alert">
          <p>{error}</p>
          <button
            className="recommendation-retry mt-3 px-3 py-2"
            onClick={() => void search()}
            type="button"
          >
            {translate(locale, 'recommendations.retry')}
          </button>
        </div>
      ) : null}
      {response === undefined ? null : (
        <div aria-live="polite" className="mt-4">
          <p className="text-sm text-slate-700">
            {translate(locale, 'recommendations.current')}{' '}
            <strong>
              {formatDateTime(locale, props.checkIn)} - {formatDateTime(locale, props.checkOut)}
            </strong>
            {' · '}
            {formatVnd(locale, response.exactResult.finalAmountVnd)}
          </p>
          {response.recommendations.length === 0 ? (
            <p className="mt-3">{translate(locale, 'recommendations.none')}</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {response.recommendations.map((candidate, index) => (
                <li
                  key={`${candidate.checkIn}-${index}`}
                  className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0"
                >
                  <h3 className="font-medium">
                    {translatePlanLabel(locale, candidate.selectedPlanCode)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(locale, candidate.checkIn)} -{' '}
                    {formatDateTime(locale, candidate.checkOut)} ·{' '}
                    {describeShift(locale, candidate.shiftMinutes)}
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">
                        {translate(locale, 'recommendations.duration')}
                      </dt>
                      <dd>
                        {translate(locale, 'recommendations.minutes', {
                          minutes: durationMinutes(candidate.checkIn, candidate.checkOut),
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        {translate(locale, 'recommendations.originalAmount')}
                      </dt>
                      <dd>{formatVnd(locale, response.exactResult.finalAmountVnd)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        {translate(locale, 'recommendations.recommendedAmount')}
                      </dt>
                      <dd>{formatVnd(locale, candidate.finalAmountVnd)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        {translate(locale, 'recommendations.savings')}
                      </dt>
                      <dd>{formatVnd(locale, candidate.savingsVnd)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm text-slate-600">
                    {translate(locale, 'recommendations.availability', {
                      status:
                        candidate.availabilityStatus === 'AVAILABLE'
                          ? translate(locale, 'recommendations.available')
                          : candidate.availabilityStatus === 'UNKNOWN'
                            ? translate(locale, 'recommendations.unknown')
                            : translate(locale, 'recommendations.unavailable'),
                    })}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {translate(locale, 'recommendations.noBookingChanged')}
                  </p>
                  <button
                    className="hospitality-button mt-3 px-4 py-2 disabled:opacity-60"
                    disabled={applying || candidate.availabilityStatus === 'UNAVAILABLE'}
                    onClick={() =>
                      void applyCandidate(
                        candidate.checkIn,
                        candidate.checkOut,
                        candidate.selectedPlanCode,
                      )
                    }
                    type="button"
                  >
                    {applying
                      ? translate(locale, 'recommendations.applying')
                      : translate(locale, 'recommendations.apply')}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
