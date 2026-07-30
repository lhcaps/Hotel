'use client';

import type { BookingHoldCouponSummary, CouponQuoteSummary } from '@room/contracts';

import { formatVnd, translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export interface CouponSummaryProps {
  readonly coupon: BookingHoldCouponSummary | CouponQuoteSummary;
  /**
   * When true, render the revalidation notice beneath the totals. The notice
   * is only safe to show for the provisional quote case.
   */
  readonly showRevalidationNotice?: boolean;
  readonly testId?: string;
}

export function CouponSummary({
  coupon,
  showRevalidationNotice = false,
  testId,
}: CouponSummaryProps) {
  const locale = useLocale();
  const revalidationNotice = 'revalidationNotice' in coupon ? coupon.revalidationNotice : undefined;
  return (
    <section
      aria-labelledby="coupon-summary-heading"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
      data-testid={testId ?? 'coupon-summary'}
    >
      <h3
        className="text-sm font-semibold uppercase tracking-wide text-emerald-800"
        id="coupon-summary-heading"
      >
        {translate(locale, 'coupon.heading', { code: coupon.code })}
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        {translate(locale, coupon.discountType === 'PERCENTAGE' ? 'coupon.percentage' : 'coupon.fixed')}
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">{translate(locale, 'coupon.gross')}</dt>
          <dd className="font-mono font-medium">{formatVnd(locale, coupon.grossAmountVnd)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'coupon.discount')}</dt>
          <dd className="font-mono font-medium text-emerald-700">
            −{formatVnd(locale, coupon.discountAmountVnd)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{translate(locale, 'coupon.final')}</dt>
          <dd className="font-mono font-semibold">{formatVnd(locale, coupon.finalAmountVnd)}</dd>
        </div>
      </dl>
      {showRevalidationNotice && revalidationNotice !== undefined ? (
        <p className="mt-3 text-xs text-slate-600" data-testid="coupon-revalidation-notice">
          {revalidationNotice}
        </p>
      ) : null}
    </section>
  );
}
