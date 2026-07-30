import { describe, expect, it } from 'vitest';

import { adminPaymentReconcileRequestSchema } from '../src/index.js';

describe('admin payment reconciliation contracts', () => {
  it('exposes the reconciliation request validator through the public package boundary', () => {
    expect(
      adminPaymentReconcileRequestSchema.parse({
        expectedAttemptId: '550e8400-e29b-41d4-a716-446655440000',
        expectedUpdatedAt: '2026-07-28T10:00:00.000Z',
        note: 'Provider status needs an operational review.',
      }),
    ).toEqual({
      expectedAttemptId: '550e8400-e29b-41d4-a716-446655440000',
      expectedUpdatedAt: '2026-07-28T10:00:00.000Z',
      note: 'Provider status needs an operational review.',
    });
  });
});
