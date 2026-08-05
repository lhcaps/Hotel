import { describe, expect, it } from 'vitest';

import { compareRoomDisplayOrder } from './admin-natural-sort';

describe('compareRoomDisplayOrder', () => {
  it('orders the operational room examples by tier, floor, and numeric suffix', () => {
    const rooms = ['101', 'G03', '201', 'G01', '102', 'G02', '301', '203', '202', '103'];

    expect(rooms.toSorted(compareRoomDisplayOrder)).toEqual([
      'G01',
      'G02',
      'G03',
      '101',
      '102',
      '103',
      '201',
      '202',
      '203',
      '301',
    ]);
  });

  it('uses a stable natural fallback for mixed room codes', () => {
    expect(['S-10', 'S-2', 'S-1'].toSorted(compareRoomDisplayOrder)).toEqual([
      'S-1',
      'S-2',
      'S-10',
    ]);
  });
});
