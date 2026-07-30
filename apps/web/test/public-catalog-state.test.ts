import { describe, expect, it } from 'vitest';

import { toPublicCatalogState } from '../src/lib/public-catalog-state';

describe('toPublicCatalogState', () => {
  it('returns unavailable when the catalog is null', () => {
    expect(toPublicCatalogState(null)).toEqual({ kind: 'unavailable' });
  });

  it('returns empty when the API has zero active room types', () => {
    expect(toPublicCatalogState({ items: [] })).toEqual({ kind: 'empty' });
  });

  it('returns ready when the API has at least one room type', () => {
    const catalog = {
      items: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Deluxe',
          description: null,
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 3,
          amenities: [],
        },
      ],
    };
    expect(toPublicCatalogState(catalog)).toEqual({ kind: 'ready', catalog });
  });
});
