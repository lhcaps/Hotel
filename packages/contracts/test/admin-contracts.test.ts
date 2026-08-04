import { describe, expect, it } from 'vitest';

import {
  archiveCommandSchema,
  maintenanceBlockCommandSchema,
  paginationQuerySchema,
  problemDetailsSchema,
  roomSchema,
  roomHousekeepingCommandSchema,
  roomTypeCommandSchema,
} from '../src/index.js';

describe('admin catalog contracts', () => {
  it('exposes a truthful housekeeping state for a room', () => {
    expect(
      roomSchema.parse({
        id: 'f0db7698-6995-4c8e-a6cb-0d82e6f8281c',
        propertyId: '72fec1a4-4df0-4c43-a7d4-a4f622d79e0a',
        roomTypeId: '7dd2f7dc-44bb-4f46-a1d4-1f0bb7c70847',
        roomNumber: 'S-01',
        physicalRoomCode: '94BDT-SabiG02',
        status: 'ACTIVE',
        housekeepingStatus: 'CLEANING',
        createdAt: '2026-07-29T00:00:00.000Z',
        updatedAt: '2026-07-29T00:00:00.000Z',
      }),
    ).toMatchObject({ housekeepingStatus: 'CLEANING' });
  });

  it('allows only explicit housekeeping values', () => {
    expect(roomHousekeepingCommandSchema.parse({ status: 'DIRTY' })).toEqual({ status: 'DIRTY' });
    expect(() => roomHousekeepingCommandSchema.parse({ status: 'UNKNOWN' })).toThrow();
  });

  it('bounds pagination and normalizes catalog codes', () => {
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '25' })).toEqual({
      page: 2,
      pageSize: 25,
    });
    expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();

    expect(
      roomTypeCommandSchema.parse({
        code: ' dlx-01 ',
        name: 'Deluxe',
        priceTierId: '550e8400-e29b-41d4-a716-446655440000',
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
      }).code,
    ).toBe('DLX-01');
  });

  it('rejects invalid capacity, archive payloads, and maintenance intervals', () => {
    expect(() =>
      roomTypeCommandSchema.parse({
        code: 'DLX',
        name: 'Deluxe',
        priceTierId: '550e8400-e29b-41d4-a716-446655440000',
        maxAdults: 2,
        maxChildren: 0,
        maxOccupancy: 1,
      }),
    ).toThrow();
    expect(archiveCommandSchema.parse({}).archive).toBe(true);
    expect(() => archiveCommandSchema.parse({ archive: false })).toThrow();
    expect(() =>
      maintenanceBlockCommandSchema.parse({
        roomId: '550e8400-e29b-41d4-a716-446655440000',
        startsAt: '2027-01-01T12:00:00.000Z',
        endsAt: '2027-01-01T12:00:00.000Z',
        reason: 'Repair',
      }),
    ).toThrow();
  });

  it('parses the exact safe problem-details envelope', () => {
    const problem = problemDetailsSchema.parse({
      type: 'catalog-conflict',
      title: 'Room time conflict',
      status: 409,
      code: 'ROOM_TIME_CONFLICT',
      detail: 'The selected room is unavailable in that interval.',
      requestId: 'request-1',
      errors: [{ field: 'startsAt', message: 'Choose a later time.' }],
    });

    expect(problem).toEqual({
      type: 'catalog-conflict',
      title: 'Room time conflict',
      status: 409,
      code: 'ROOM_TIME_CONFLICT',
      detail: 'The selected room is unavailable in that interval.',
      requestId: 'request-1',
      errors: [{ field: 'startsAt', message: 'Choose a later time.' }],
    });
    expect(() => problemDetailsSchema.parse({ ...problem, password: 'not-allowed' })).toThrow();
  });
});
