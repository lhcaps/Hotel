import { describe, expect, it } from 'vitest';

import {
  defaultLocale,
  formatDateTime,
  formatVnd,
  isLocale,
  resolveLocale,
  translate,
} from '../src/lib/i18n/messages';

describe('local UI messages', () => {
  it('supports only Vietnamese and English with Vietnamese as the default', () => {
    expect(defaultLocale).toBe('vi');
    expect(isLocale('vi')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('invalid')).toBe('vi');
  });

  it('translates critical locale-control labels without translating codes', () => {
    expect(translate('vi', 'locale.switch')).toBe('English');
    expect(translate('en', 'locale.switch')).toBe('Tiếng Việt');
    expect(translate('en', 'payment.provider.momo')).toBe('MoMo');
  });

  it('keeps booking data identities out of translation dictionaries while translating critical search controls', () => {
    expect(translate('en', 'search.heading')).toBe('Find a room');
    expect(translate('en', 'search.quote')).toBe('Get a quote');
    expect(translate('en', 'admin.bookings')).toBe('Bookings');
    expect(translate('en', 'payment.provider.momo')).toBe('MoMo');
  });

  it('interpolates variables at the localization boundary', () => {
    expect(translate('en', 'search.availabilitySummary', { rooms: 2, guests: 3 })).toBe(
      '2 room(s) available · up to 3 guests',
    );
  });

  it('formats authoritative VND and instants for the selected locale without changing their values', () => {
    expect(formatVnd('en', 359000)).toBe('₫359,000');
    expect(formatVnd('vi', 359000)).toContain('359.000');
    expect(formatDateTime('en', '2027-01-10T03:00:00.000Z')).toContain('10:00');
  });
});
