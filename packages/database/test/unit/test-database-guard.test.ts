import { describe, expect, it } from 'vitest';

import { assertSafeTestDatabaseUrl, createUniqueTestDatabaseName } from '../../src/testing.js';

describe('test database safety guard', () => {
  it.each([
    'postgresql://room:room@example.com:5432/room_management_test_base',
    'postgresql://room:room@localhost:5432/room_management',
    'postgresql://room:room@localhost:5432/room_management_test_',
    'postgresql://room:room@127.0.0.1:5432/postgres',
  ])('rejects an unsafe destructive-test URL: %s', (value) => {
    expect(() => assertSafeTestDatabaseUrl(value)).toThrow(/refusing destructive database/i);
  });

  it('accepts loopback and an explicitly configured CI host with the required prefix', () => {
    expect(
      assertSafeTestDatabaseUrl('postgresql://room:room@localhost:5432/room_management_test_base')
        .hostname,
    ).toBe('localhost');
    expect(
      assertSafeTestDatabaseUrl(
        'postgresql://room:room@postgres-ci:5432/room_management_test_base',
        { allowedCiHost: 'postgres-ci' },
      ).hostname,
    ).toBe('postgres-ci');
  });

  it.each([
    '?host=database.example.com',
    '?hostaddr=203.0.113.10',
    '?port=6543',
    '?dbname=postgres',
    '?database=postgres',
  ])('rejects a query-string destination override: %s', (query) => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        `postgresql://room:room@localhost:5432/room_management_test_base${query}`,
      ),
    ).toThrow(/refusing destructive database/i);
  });

  it('creates a unique identifier-safe database name under the guarded prefix', () => {
    const first = createUniqueTestDatabaseName();
    const second = createUniqueTestDatabaseName();

    expect(first).toMatch(/^room_management_test_[a-f0-9]{32}$/);
    expect(second).toMatch(/^room_management_test_[a-f0-9]{32}$/);
    expect(second).not.toBe(first);
  });
});
