import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '../src/components/locale-provider';
import { translate } from '../src/lib/i18n/messages';

function renderWith(locale: 'vi' | 'en', node: React.ReactNode) {
  return render(<LocaleProvider locale={locale}>{node}</LocaleProvider>);
}

describe('critical customer i18n copy', () => {
  it('provides Vietnamese translation for included minutes', () => {
    expect(
      translate('vi', 'ratePlan.includeDuration', { minutes: 180 }),
    ).toBe('Bao gồm 180 phút.');
    expect(translate('vi', 'ratePlan.includedDurationCopy', { minutes: 180 })).toContain('phút');
  });

  it('provides English translation for included minutes', () => {
    expect(
      translate('en', 'ratePlan.includeDuration', { minutes: 180 }),
    ).toBe('Includes 180 minutes.');
    expect(translate('en', 'ratePlan.includedDurationCopy', { minutes: 180 })).toContain('minutes');
  });

  it('provides Vietnamese translation for the extra hour(s) line', () => {
    const text = translate('vi', 'ratePlan.extraHourCopy', { count: 2 });
    expect(text).not.toContain('extra hour');
    expect(text.toLowerCase()).toMatch(/phút|giờ/);
  });

  it('provides English translation for the extra hour(s) line', () => {
    const text = translate('en', 'ratePlan.extraHourCopy', { count: 2 });
    expect(text).toMatch(/extra\s+hour/i);
  });

  it('provides Vietnamese translation for print confirmation', () => {
    expect(translate('vi', 'hold.printConfirmation')).toBe('In mã xác nhận');
  });

  it('provides English translation for print confirmation', () => {
    expect(translate('en', 'hold.printConfirmation')).toBe('Print confirmation');
  });

  it('renders the Vietnamese quote rate-plan offer block through the typed i18n keys', () => {
    renderWith(
      'vi',
      <>
        <span data-testid="included-minutes">
          {translate('vi', 'ratePlan.includedDurationCopy', { minutes: 180 })}
        </span>
        <span data-testid="extra-hours">
          {translate('vi', 'ratePlan.extraHourCopy', { count: 2 })}
        </span>
        <span data-testid="print-confirmation">
          {translate('vi', 'hold.printConfirmation')}
        </span>
        <span data-testid="payment-init-error">
          {translate('vi', 'payment.initError')}
        </span>
        <span data-testid="payment-retry">
          {translate('vi', 'recommendations.retry')}
        </span>
      </>,
    );

    const included = screen.getByTestId('included-minutes').textContent ?? '';
    const extra = screen.getByTestId('extra-hours').textContent ?? '';
    const print = screen.getByTestId('print-confirmation').textContent ?? '';
    const initError = screen.getByTestId('payment-init-error').textContent ?? '';
    const retry = screen.getByTestId('payment-retry').textContent ?? '';

    expect(included).not.toContain('minutes included');
    expect(extra).not.toContain('extra hour');
    expect(print).toBe('In mã xác nhận');
    expect(initError).toMatch(/thanh toán/i);
    expect(retry).toMatch(/thử lại/i);
  });

  it('renders the English quote rate-plan offer block through the typed i18n keys', () => {
    renderWith(
      'en',
      <>
        <span data-testid="included-minutes">
          {translate('en', 'ratePlan.includedDurationCopy', { minutes: 180 })}
        </span>
        <span data-testid="extra-hours">
          {translate('en', 'ratePlan.extraHourCopy', { count: 2 })}
        </span>
        <span data-testid="print-confirmation">
          {translate('en', 'hold.printConfirmation')}
        </span>
        <span data-testid="payment-init-error">
          {translate('en', 'payment.initError')}
        </span>
        <span data-testid="payment-retry">
          {translate('en', 'recommendations.retry')}
        </span>
      </>,
    );

    const included = screen.getByTestId('included-minutes').textContent ?? '';
    const extra = screen.getByTestId('extra-hours').textContent ?? '';
    const print = screen.getByTestId('print-confirmation').textContent ?? '';
    const initError = screen.getByTestId('payment-init-error').textContent ?? '';
    const retry = screen.getByTestId('payment-retry').textContent ?? '';

    expect(included).toMatch(/180 minutes/);
    expect(extra).toMatch(/extra hour/i);
    expect(print).toBe('Print confirmation');
    expect(initError.length).toBeGreaterThan(0);
    expect(retry).toMatch(/try again/i);
  });
});
