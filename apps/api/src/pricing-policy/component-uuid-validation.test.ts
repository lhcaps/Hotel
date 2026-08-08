import { test, expect } from 'vitest';
import { multiNightPricingLineSchema } from '@room/contracts';

/**
 * B0 Stage 4 P1 Defect Root Cause Test
 * 
 * Production component IDs from Stage 2 bootstrap (0030_b0_production_bootstrap.sql)
 * were hardcoded with invalid UUID variant nibbles for FINAL_NIGHT and TRAILING.
 * 
 * PostgreSQL accepts these as valid UUIDs, but Zod's strict UUID validator rejects them.
 */

// Use the actual schema that validates pricing lines in quotes
const validateComponentId = (componentId: string) => {
  return multiNightPricingLineSchema.safeParse({
    componentId,
    componentCode: 'TEST',
    componentDigest: 'a'.repeat(64),
    startAt: '2026-08-09T21:00:00+07:00',
    endAt: '2026-08-10T21:00:00+07:00',
    coverageModel: 'FIXED_ELAPSED',
    boundaryPosition: null,
    billingModel: 'FIXED_OCCURRENCE',
    occurrenceCount: 1,
    billingUnitQuantity: 1,
    unitAmountVnd: 1000,
    lineAmountVnd: 1000,
    restrictions: {},
    sourceV1Provenance: null,
  });
};

const PRODUCTION_COMPONENT_IDS = {
  B0_LEADING: 'a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d',
  B0_CONTINUATION: 'b2c3d4e5-f6a1-4b2c-9d0e-1f2a3b4c5d6e',
  B0_FINAL_NIGHT: 'c3d4e5f6-a1b2-4c3d-0e1f-2a3b4c5d6e7f',
  B0_TRAILING: 'd4e5f6a1-b2c3-4d4e-1f2a-3b4c5d6e7f8a',
};

test('B0_LEADING component ID is valid RFC 4122 UUID', () => {
  const result = validateComponentId(PRODUCTION_COMPONENT_IDS.B0_LEADING);
  expect(result.success).toBe(true);
});

test('B0_CONTINUATION component ID is valid RFC 4122 UUID', () => {
  const result = validateComponentId(PRODUCTION_COMPONENT_IDS.B0_CONTINUATION);
  expect(result.success).toBe(true);
});

test('B0_FINAL_NIGHT component ID fails strict UUID validation (variant nibble 0)', () => {
  const result = validateComponentId(PRODUCTION_COMPONENT_IDS.B0_FINAL_NIGHT);
  expect(result.success).toBe(false);
  if (!result.success) {
    // Zod may nest the error under issues
    const firstError = result.error.issues?.[0] ?? result.error.errors?.[0];
    expect(firstError).toBeDefined();
    expect(firstError.message).toBe('Invalid UUID');
    expect(firstError.path).toContain('componentId');
  }
});

test('B0_TRAILING component ID fails strict UUID validation (variant nibble 1)', () => {
  const result = validateComponentId(PRODUCTION_COMPONENT_IDS.B0_TRAILING);
  expect(result.success).toBe(false);
  if (!result.success) {
    const firstError = result.error.issues?.[0] ?? result.error.errors?.[0];
    expect(firstError).toBeDefined();
    expect(firstError.message).toBe('Invalid UUID');
    expect(firstError.path).toContain('componentId');
  }
});

test('UUID variant nibble analysis shows root cause', () => {
  const getVariantNibble = (uuid: string) => uuid.charAt(19);
  
  // Valid UUIDs have variant nibble in [89abAB]
  expect(['8', '9', 'a', 'b', 'A', 'B']).toContain(
    getVariantNibble(PRODUCTION_COMPONENT_IDS.B0_LEADING)
  );
  expect(['8', '9', 'a', 'b', 'A', 'B']).toContain(
    getVariantNibble(PRODUCTION_COMPONENT_IDS.B0_CONTINUATION)
  );
  
  // Invalid UUIDs have wrong variant nibble
  expect(getVariantNibble(PRODUCTION_COMPONENT_IDS.B0_FINAL_NIGHT)).toBe('0');
  expect(getVariantNibble(PRODUCTION_COMPONENT_IDS.B0_TRAILING)).toBe('1');
});
