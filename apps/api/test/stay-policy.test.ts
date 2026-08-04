import { describe, expect, it } from 'vitest';

import {
  isSupportedOvernightWindow,
  isWithinPropertyStayPolicy,
} from '../src/pricing/stay-policy.js';

const policy = {
  minimumStayMinutes: 60,
  maximumStayMinutes: 10_080,
  minimumLeadTimeMinutes: 0,
  maximumAdvanceBookingDays: 365,
  defaultOvernightDurationMinutes: 720,
};

describe('stay policy', () => {
  it('accepts only the two exact one-night windows', () => {
    expect(
      isSupportedOvernightWindow(
        '2026-08-07T21:00:00+07:00',
        '2026-08-08T09:00:00+07:00',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(true);
    expect(
      isSupportedOvernightWindow(
        '2026-08-07T22:00:00+07:00',
        '2026-08-08T10:00:00+07:00',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(true);
    expect(
      isSupportedOvernightWindow(
        '2026-08-07T21:00:00+07:00',
        '2026-08-09T09:00:00+07:00',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
    expect(
      isSupportedOvernightWindow(
        '2026-08-07T21:00:17+07:00',
        '2026-08-08T09:00:42+07:00',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
  });

  it('returns INVALID_INTERVAL semantics for crafted overnight multi-night input', () => {
    expect(
      isWithinPropertyStayPolicy(
        '2026-08-07T21:00:00+07:00',
        '2026-08-09T09:00:00+07:00',
        policy,
        Date.parse('2026-08-01T00:00:00Z'),
        'overnight',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
  });
});
