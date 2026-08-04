'use client';

import { useLocale } from './locale-provider';
import { formatDateTime, translate } from '../lib/i18n/messages';

export interface CancellationPolicySummaryValue {
  readonly code: string;
  readonly version: number;
  readonly timezone: string;
  readonly refundBasis: 'PAID_AMOUNT';
  readonly capturedAt: string;
  readonly checkIn: string;
  readonly sevenDayDeadline: string;
  readonly threeDayDeadline: string;
}

export interface CancellationPolicySummaryProps {
  readonly policy?: CancellationPolicySummaryValue | null;
  readonly className?: string;
}

export function CancellationPolicySummary({ policy, className }: CancellationPolicySummaryProps) {
  const locale = useLocale();
  return (
    <section
      aria-labelledby="cancellation-policy-summary-heading"
      className={className}
      data-testid="cancellation-policy-summary"
    >
      <h2 id="cancellation-policy-summary-heading">
        {translate(locale, 'account.cancellationPolicy')}
      </h2>
      {policy === null || policy === undefined ? (
        <p>{translate(locale, 'account.cancellationPolicyUnavailable')}</p>
      ) : (
        <div>
          <p>{translate(locale, 'account.cancellationPolicyBasis')}</p>
          <ul>
            <li>{translate(locale, 'account.cancellationRule7Days')}</li>
            <li>{translate(locale, 'account.cancellationRule3Days')}</li>
            <li>{translate(locale, 'account.cancellationRuleUnder3Days')}</li>
          </ul>
          <p>
            {translate(locale, 'account.cancellationBoundary7Days')}:{' '}
            {formatDateTime(locale, policy.sevenDayDeadline)} ·{' '}
            {translate(locale, 'account.cancellationBoundary3Days')}:{' '}
            {formatDateTime(locale, policy.threeDayDeadline)} ({policy.timezone})
          </p>
          <p>
            {policy.code} v{policy.version} · {formatDateTime(locale, policy.capturedAt)}
          </p>
        </div>
      )}
    </section>
  );
}
