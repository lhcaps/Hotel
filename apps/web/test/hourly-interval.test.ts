import { describe, expect, it } from 'vitest';

import { buildHourlyInterval } from '../src/lib/booking-search-state';

describe('buildHourlyInterval', () => {
  it('keeps the same date when the duration fits within the same day', () => {
    const result = buildHourlyInterval({
      date: '2026-07-31',
      time: '20:00',
      durationMinutes: 180,
    });
    expect(result.checkIn).toBe('2026-07-31T20:00:00+07:00');
    expect(result.checkOut).toBe('2026-07-31T23:00:00+07:00');
  });

  it('rolls the date forward when the duration crosses midnight', () => {
    const result = buildHourlyInterval({
      date: '2026-07-31',
      time: '23:00',
      durationMinutes: 180,
    });
    expect(result.checkIn).toBe('2026-07-31T23:00:00+07:00');
    expect(result.checkOut).toBe('2026-08-01T02:00:00+07:00');
  });

  it('rolls the month boundary when the duration crosses midnight', () => {
    const result = buildHourlyInterval({
      date: '2026-12-31',
      time: '23:45',
      durationMinutes: 60,
    });
    expect(result.checkIn).toBe('2026-12-31T23:45:00+07:00');
    expect(result.checkOut).toBe('2027-01-01T00:45:00+07:00');
  });

  it('rounds to the next quarter hour before adding duration', () => {
    const result = buildHourlyInterval({
      date: '2026-07-31',
      time: '23:53',
      durationMinutes: 15,
    });
    expect(result.checkIn).toBe('2026-08-01T00:00:00+07:00');
    expect(result.checkOut).toBe('2026-08-01T00:15:00+07:00');
  });

  it('rejects a duration below 60 minutes', () => {
    expect(() =>
      buildHourlyInterval({ date: '2026-07-31', time: '20:00', durationMinutes: 45 }),
    ).toThrow();
  });

  it('rejects a duration above 1440 minutes', () => {
    expect(() =>
      buildHourlyInterval({ date: '2026-07-31', time: '20:00', durationMinutes: 1500 }),
    ).toThrow();
  });

  it('rejects a duration that is not divisible by 15', () => {
    expect(() =>
      buildHourlyInterval({ date: '2026-07-31', time: '20:00', durationMinutes: 61 }),
    ).toThrow();
  });

  it('rejects an invalid date', () => {
    expect(() =>
      buildHourlyInterval({ date: 'not-a-date', time: '20:00', durationMinutes: 180 }),
    ).toThrow();
  });

  it('rejects an invalid time', () => {
    expect(() =>
      buildHourlyInterval({ date: '2026-07-31', time: '99:99', durationMinutes: 180 }),
    ).toThrow();
  });
});
