import { describe, expect, it } from 'vitest';

import { isCatalogSafetyCode, localizedCatalogSafetyReason } from '../src/lib/catalog-safety';

describe('localizedCatalogSafetyReason', () => {
  it('maps ROOM_ARCHIVE_ACTIVE_BOOKING to the Vietnamese localized message', () => {
    const text = localizedCatalogSafetyReason('vi', 'ROOM_ARCHIVE_ACTIVE_BOOKING', undefined);
    expect(text).toMatch(/đặt phòng đang hoạt động/);
  });

  it('maps ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS to the English localized message', () => {
    const text = localizedCatalogSafetyReason('en', 'ROOM_TYPE_ARCHIVE_ACTIVE_ROOMS', undefined);
    expect(text).toMatch(/active physical rooms/);
  });

  it('falls back to the server-supplied detail when the code is unknown', () => {
    const text = localizedCatalogSafetyReason(
      'en',
      'SOME_OTHER_CODE',
      'Detail from server that explains the rejection.',
    );
    expect(text).toBe('Detail from server that explains the rejection.');
  });

  it('falls back to a generic safety message when no code and no detail are present', () => {
    const text = localizedCatalogSafetyReason('en', undefined, undefined);
    expect(text).toMatch(/cannot be archived/);
  });

  it('reports only known structured codes', () => {
    expect(isCatalogSafetyCode('ROOM_ARCHIVE_ACTIVE_BOOKING')).toBe(true);
    expect(isCatalogSafetyCode('ROOM_TYPE_ARCHIVE_ACTIVE_RATE_PLAN')).toBe(true);
    expect(isCatalogSafetyCode('CATALOG_CONFLICT')).toBe(false);
    expect(isCatalogSafetyCode(undefined)).toBe(false);
    expect(isCatalogSafetyCode(123)).toBe(false);
  });

  it('does not silently map codes the API never emits', () => {
    expect(isCatalogSafetyCode('ROOM_TYPE_ARCHIVE_RANDOM_NEW_CODE')).toBe(false);
  });
});
