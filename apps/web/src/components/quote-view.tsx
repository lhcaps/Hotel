'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { BookingHoldResponse, Quote } from '@room/contracts';

import { publicApi } from '../lib/admin-api';
import { AdminApiError } from '../lib/admin-api';
import { BookingApiError } from '../lib/booking-api';
import { translate, type Locale } from '../lib/i18n/messages';
import { CouponInput } from './coupon-input';
import { HoldSuccessPanel } from './hold-success-panel';
import { QuoteContactForm } from './quote-contact-form';
import { QuoteSummary } from './quote-summary';
import { StayTimeRecommendations } from './stay-time-recommendations';
import { useLocale } from './locale-provider';

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly quote: Quote };

interface ActiveHold {
  readonly hold: BookingHoldResponse;
  readonly email: string;
}

export interface QuoteContext {
  readonly roomTypeId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: string;
  readonly children: string;
}

function describeError(locale: Locale, error: unknown): string {
  if (error instanceof BookingApiError) {
    return error.message;
  }
  return translate(locale, 'quote.notFoundError');
}

function couponErrorMessageFor(locale: Locale, code: string): string {
  if (code === 'COUPON_NOT_APPLICABLE' || code === 'COUPON_NOT_FOUND_OR_UNAVAILABLE') {
    return translate(locale, 'quote.couponInvalid');
  }
  if (code === 'COUPON_EXPIRED') {
    return translate(locale, 'quote.couponExpired');
  }
  if (code === 'COUPON_MINIMUM_NOT_MET') {
    return translate(locale, 'quote.couponMinimum');
  }
  if (code === 'COUPON_HOLD_WINDOW_INCOMPATIBLE') {
    return translate(locale, 'quote.couponWindow');
  }
  return translate(locale, 'quote.couponInvalid');
}

function describeCouponError(locale: Locale, error: unknown): string {
  if (error instanceof BookingApiError) {
    return couponErrorMessageFor(locale, error.code ?? 'UNKNOWN_ERROR');
  }
  if (error instanceof AdminApiError) {
    const code = (error.problem as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return couponErrorMessageFor(locale, code);
  }
  return translate(locale, 'quote.couponError');
}

function buildContextQuery(context: QuoteContext): string {
  const params = new URLSearchParams({
    roomTypeId: context.roomTypeId,
    checkIn: context.checkIn,
    checkOut: context.checkOut,
    adults: context.adults,
    children: context.children,
  });
  return params.toString();
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value,
  );
}

export function QuoteView({
  id,
  context,
}: {
  readonly id: string;
  readonly context: QuoteContext | null;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [activeHold, setActiveHold] = useState<ActiveHold | undefined>();
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const loadTokenRef = useRef(0);

  useEffect(() => {
    if (!isValidUuid(id)) {
      setState({ kind: 'error', message: translate(locale, 'quote.invalidCode') });
      return;
    }
    const token = (loadTokenRef.current += 1);
    let cancelled = false;
    void publicApi
      .quote(id)
      .then((quote) => {
        if (cancelled || loadTokenRef.current !== token) return;
        setState({ kind: 'ready', quote });
      })
      .catch((error: unknown) => {
        if (cancelled || loadTokenRef.current !== token) return;
        setState({ kind: 'error', message: describeError(locale, error) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, locale]);

  async function reissueQuote(couponCode: string): Promise<void> {
    if (context === null) {
      setCouponError(translate(locale, 'quote.contextRequired'));
      return;
    }
    setCouponError(null);
    setCouponPending(true);
    const token = (loadTokenRef.current += 1);
    try {
      const result = await publicApi.issueQuote({
        roomTypeId: context.roomTypeId,
        checkIn: context.checkIn,
        checkOut: context.checkOut,
        adults: Number(context.adults),
        children: Number(context.children),
        ...(couponCode.length > 0 ? { couponCode } : {}),
      });
      if (token !== loadTokenRef.current) return;
      const query = buildContextQuery(context);
      router.push(`/booking/quote/${result.id}?${query}`);
    } catch (error) {
      if (token !== loadTokenRef.current) return;
      setCouponError(describeCouponError(locale, error));
    } finally {
      if (token === loadTokenRef.current) {
        setCouponPending(false);
      }
    }
  }

  if (state.kind === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center p-8">
        <p aria-live="polite" className="text-slate-600">
          {translate(locale, 'quote.loading')}
        </p>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center p-8">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">{translate(locale, 'quote.missingHeading')}</h1>
          <p className="mt-2 text-slate-600" role="alert">
            {state.message}
          </p>
          <Link
            className="mt-4 inline-block rounded-md bg-sky-700 px-4 py-2 font-medium text-white"
            href="/booking/search"
          >
            {translate(locale, 'quote.searchAgain')}
          </Link>
        </div>
      </main>
    );
  }

  const { quote } = state;
  if (activeHold !== undefined) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center p-8">
        <div className="w-full space-y-6">
          <HoldSuccessPanel
            bookingCode={activeHold.hold.bookingCode}
            email={activeHold.email}
            hold={activeHold.hold}
            onManageBooking={() => {
              globalThis.location.assign('/booking/manage');
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="quote-page" id="main-content">
      <div className="quote-page__inner">
        <header className="quote-page__intro">
          <p className="quote-page__eyebrow">{translate(locale, 'quote.eyebrow')}</p>
          <ol aria-label={translate(locale, 'quote.completeHold')} className="booking-stepper">
            <li>{translate(locale, 'booking.step.roomAndRate')}</li>
            <li className="booking-stepper__current">
              {translate(locale, 'booking.step.contact')}
            </li>
            <li>{translate(locale, 'booking.step.confirm')}</li>
            <li>{translate(locale, 'booking.step.payment')}</li>
            <li>{translate(locale, 'booking.step.complete')}</li>
          </ol>
          <h1>{translate(locale, 'quote.completeHold')}</h1>
          <p>{translate(locale, 'quote.holdHelp')}</p>
        </header>
        <div className="quote-page__layout">
          <div className="quote-page__main">
            <QuoteSummary quote={quote} />
            {context !== null ? (
              <StayTimeRecommendations
                roomTypeId={context.roomTypeId}
                checkIn={context.checkIn}
                checkOut={context.checkOut}
                adults={Number(context.adults)}
                children={Number(context.children)}
                {...(quote.coupon?.code !== undefined && quote.coupon.code !== ''
                  ? { couponCode: quote.coupon.code }
                  : {})}
              />
            ) : null}
            <CouponInput
              appliedCode={quote.coupon?.code ?? null}
              errorMessage={couponError}
              pending={couponPending}
              onApply={reissueQuote}
              onClear={() => {
                void reissueQuote('');
              }}
            />
          </div>
          <aside className="quote-page__summary">
            <QuoteContactForm
              quote={quote}
              onHoldCreated={(hold, email) => setActiveHold({ hold, email })}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
