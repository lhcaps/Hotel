import { describe, expect, it } from 'vitest';

import {
  deriveStayFacts,
  isSupportedOvernightWindow,
  isWithinPropertyStayPolicy,
} from '../src/pricing/stay-policy.js';

const policy = (maximumStayMinutes = 4_320) => ({
  minimumStayMinutes: 60,
  maximumStayMinutes,
  minimumLeadTimeMinutes: 0,
  maximumAdvanceBookingDays: 365,
  defaultOvernightDurationMinutes: 720,
});

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
        policy(),
        Date.parse('2026-08-01T00:00:00Z'),
        'overnight',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
  });

  it('accepts the configured multi-night property maximum exactly and rejects one minute over', () => {
    const now = Date.parse('2026-08-01T00:00:00Z');
    expect(
      isWithinPropertyStayPolicy(
        '2026-08-10T10:00:00+07:00',
        '2026-08-13T10:00:00+07:00',
        policy(4_320),
        now,
        'multi_night',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(true);
    expect(
      isWithinPropertyStayPolicy(
        '2026-08-10T10:00:00+07:00',
        '2026-08-13T10:01:00+07:00',
        policy(4_320),
        now,
        'multi_night',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
  });

  it('uses each property maximum without a production hard-coded maximum', () => {
    const now = Date.parse('2026-08-01T00:00:00Z');
    const interval = ['2026-08-10T10:00:00+07:00', '2026-08-13T10:00:00+07:00'] as const;
    expect(
      isWithinPropertyStayPolicy(
        interval[0],
        interval[1],
        policy(4_320),
        now,
        'multi_night',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(true);
    expect(
      isWithinPropertyStayPolicy(
        interval[0],
        interval[1],
        policy(2_880),
        now,
        'multi_night',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
  });

  it('keeps minimum, lead-time, and advance-booking limits authoritative', () => {
    const constrained = {
      ...policy(4_320),
      minimumStayMinutes: 120,
      minimumLeadTimeMinutes: 60,
      maximumAdvanceBookingDays: 2,
    };
    expect(
      isWithinPropertyStayPolicy(
        '2026-08-01T02:00:00+07:00',
        '2026-08-01T03:00:00+07:00',
        constrained,
        Date.parse('2026-08-01T00:30:00+07:00'),
        'multi_night',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
    expect(
      isWithinPropertyStayPolicy(
        '2026-08-04T00:00:00+07:00',
        '2026-08-04T02:00:00+07:00',
        constrained,
        Date.parse('2026-08-01T00:00:00+07:00'),
        'multi_night',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
  });

  it('derives duration from exact instants and nights from property-local calendar dates', () => {
    expect(
      deriveStayFacts('2026-08-07T23:30:17+07:00', '2026-08-08T00:30:46+07:00', 'Asia/Ho_Chi_Minh'),
    ).toEqual({ durationMinutes: 61, displayNightCount: 1 });
    expect(
      deriveStayFacts('2028-02-28T21:00:17+07:00', '2028-03-01T09:00:46+07:00', 'Asia/Ho_Chi_Minh'),
    ).toEqual({ durationMinutes: 2_161, displayNightCount: 2 });
  });

  it('derives cross-year and leap-day display nights without using duration divided by 1440', () => {
    expect(
      deriveStayFacts('2027-12-31T23:30:00+07:00', '2028-01-01T00:30:00+07:00', 'Asia/Ho_Chi_Minh')
        .displayNightCount,
    ).toBe(1);
    expect(
      deriveStayFacts('2028-02-28T23:30:00+07:00', '2028-03-01T00:30:00+07:00', 'Asia/Ho_Chi_Minh')
        .displayNightCount,
    ).toBe(2);
  });

  it('rejects reversed intervals while preserving overnight fixed-window compatibility', () => {
    expect(
      isWithinPropertyStayPolicy(
        '2026-08-10T10:00:00+07:00',
        '2026-08-10T09:59:00+07:00',
        policy(),
        Date.parse('2026-08-01T00:00:00Z'),
        'multi_night',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
    expect(
      isWithinPropertyStayPolicy(
        '2026-08-10T20:59:00+07:00',
        '2026-08-11T09:00:00+07:00',
        policy(),
        Date.parse('2026-08-01T00:00:00Z'),
        'overnight',
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe(false);
  });
});
