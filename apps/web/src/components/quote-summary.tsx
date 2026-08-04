'use client';

import type { Quote } from '@room/contracts';

import { formatDateTime, formatVnd, translate, translatePlanLabel } from '../lib/i18n/messages';
import { CouponSummary } from './coupon-summary';
import { useLocale } from './locale-provider';

export function QuoteSummary({ quote }: { readonly quote: Quote }) {
  const locale = useLocale();
  return (
    <section aria-labelledby="quote-summary-heading" className="quote-summary">
      <h2 id="quote-summary-heading" className="sr-only">
        {translate(locale, 'quote.summary')}
      </h2>
      <h1 className="text-2xl font-semibold">
        {translate(locale, 'quote.title', { roomType: quote.roomTypeName })}
      </h1>
      <p className="mt-1 text-slate-600">
        {formatDateTime(locale, quote.checkIn)} – {formatDateTime(locale, quote.checkOut)}
      </p>
      <h3 className="mt-4 text-lg font-medium">
        {translatePlanLabel(locale, quote.pricing.selectedPlanCode)}
      </h3>
      <ul className="mt-2 space-y-1 text-sm">
        {quote.pricing.lineItems.map((line) => (
          <li key={line.code}>
            {translatePlanLabel(locale, line.code)} x {line.units}:{' '}
            {formatVnd(locale, line.amountVnd)}
          </li>
        ))}
      </ul>
      <p className="mt-4">
        {translate(locale, quote.coupon !== undefined ? 'quote.grossTotal' : 'quote.total')}{' '}
        <strong className="font-mono">{formatVnd(locale, quote.pricing.totalAmountVnd)}</strong>
      </p>
      {quote.coupon !== undefined ? (
        <p className="mt-2 text-sm text-slate-600">
          {translate(locale, 'quote.afterCoupon')}{' '}
          <strong className="font-mono">{formatVnd(locale, quote.coupon.finalAmountVnd)}</strong>
        </p>
      ) : null}
      <p className="mt-2 text-sm text-slate-600">
        {translate(locale, 'quote.expires', { time: formatDateTime(locale, quote.expiresAt) })}
      </p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">{translate(locale, 'quote.adults')}</dt>
          <dd className="font-medium">{quote.adults}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'quote.children')}</dt>
          <dd className="font-medium">{quote.children}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'quote.basePlan')}</dt>
          <dd className="font-medium">{translatePlanLabel(locale, quote.pricing.basePlanCode)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'quote.extraHours')}</dt>
          <dd className="font-medium">{quote.pricing.extraUnits}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'quote.baseAmount')}</dt>
          <dd className="font-medium">{formatVnd(locale, quote.pricing.baseAmountVnd)}</dd>
        </div>
        {quote.pricing.extraAmountVnd > 0 ? (
          <div>
            <dt className="text-slate-500">{translate(locale, 'quote.extraAmount')}</dt>
            <dd className="font-medium">{formatVnd(locale, quote.pricing.extraAmountVnd)}</dd>
          </div>
        ) : null}
      </dl>
      {quote.coupon !== undefined ? (
        <div className="mt-4">
          <CouponSummary coupon={quote.coupon} showRevalidationNotice />
        </div>
      ) : null}
      {quote.cancellationPolicy !== undefined ? (
        <section aria-labelledby="quote-cancellation-policy-heading" className="mt-6">
          <h2 id="quote-cancellation-policy-heading" className="text-lg font-semibold">
            {translate(locale, 'account.cancellationPolicy')}
          </h2>
          <p className="mt-2 text-sm">{translate(locale, 'account.cancellationPolicyBasis')}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>{translate(locale, 'account.cancellationRule7Days')}</li>
            <li>{translate(locale, 'account.cancellationRule3Days')}</li>
            <li>{translate(locale, 'account.cancellationRuleUnder3Days')}</li>
          </ul>
          <p className="mt-2 text-sm text-slate-600">
            {translate(locale, 'account.cancellationBoundary7Days')}:{' '}
            {formatDateTime(locale, quote.cancellationPolicy.sevenDayDeadline)} ·{' '}
            {translate(locale, 'account.cancellationBoundary3Days')}:{' '}
            {formatDateTime(locale, quote.cancellationPolicy.threeDayDeadline)} (
            {quote.cancellationPolicy.timezone})
          </p>
        </section>
      ) : null}
    </section>
  );
}
