import { describe, expect, it } from 'vitest';

import { assertSafeDevelopmentSeedTarget } from '../../src/seed-development.js';

describe('development seed URL guard', () => {
  it.each([
    '?host=database.example.com',
    '?hostaddr=203.0.113.10',
    '?port=6543',
    '?dbname=postgres',
    '?database=postgres',
  ])('rejects a query-string destination override: %s', (query) => {
    expect(() =>
      assertSafeDevelopmentSeedTarget(
        `postgresql://room:room@localhost:5432/room_management${query}`,
        'development',
      ),
    ).toThrow(/loopback PostgreSQL target without connection overrides/i);
  });
});
