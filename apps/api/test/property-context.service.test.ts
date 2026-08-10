import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  PropertyContextError,
  resolveAuthorizedProperty,
} from '../src/catalog/property-context.service.js';

interface Property {
  readonly id: string;
}

const PROPERTY_A: Property = { id: 'aaaaaaaa-0000-0000-0000-000000000001' };
const PROPERTY_B: Property = { id: 'bbbbbbbb-0000-0000-0000-000000000002' };
const HOSTILE_UUID = 'cccccccc-0000-0000-0000-000000000003';
const ACTIVE_PROPERTIES = [PROPERTY_A, PROPERTY_B];

function codeOf(error: unknown): unknown {
  if (
    error instanceof ForbiddenException ||
    error instanceof ConflictException ||
    error instanceof NotFoundException
  ) {
    const response = error.getResponse();
    return typeof response === 'object' && response !== null && 'code' in response
      ? response.code
      : undefined;
  }
  return undefined;
}

describe('resolveAuthorizedProperty', () => {
  it('memberA read A with explicit selector -> allowed', () => {
    const actor = { propertyIds: [PROPERTY_A.id] };
    expect(resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, PROPERTY_A.id)).toBe(PROPERTY_A);
  });

  it('memberA with no explicit selector -> resolves A safely (single-property actor)', () => {
    const actor = { propertyIds: [PROPERTY_A.id] };
    expect(resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES)).toBe(PROPERTY_A);
  });

  it('memberA read B with explicit selector -> denied (PROPERTY_ACCESS_DENIED)', () => {
    const actor = { propertyIds: [PROPERTY_A.id] };
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, PROPERTY_B.id);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(codeOf(error)).toBe('PROPERTY_ACCESS_DENIED');
  });

  it('memberA supplies a hostile UUID not in the active set -> denied before any row lookup', () => {
    const actor = { propertyIds: [PROPERTY_A.id] };
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, HOSTILE_UUID);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(codeOf(error)).toBe('PROPERTY_ACCESS_DENIED');
  });

  it('memberAB explicit A -> allowed; explicit B -> allowed', () => {
    const actor = { propertyIds: [PROPERTY_A.id, PROPERTY_B.id] };
    expect(resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, PROPERTY_A.id)).toBe(PROPERTY_A);
    expect(resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, PROPERTY_B.id)).toBe(PROPERTY_B);
  });

  it('memberAB with no explicit selector -> PROPERTY_CONTEXT_REQUIRED (never silently first-active)', () => {
    const actor = { propertyIds: [PROPERTY_A.id, PROPERTY_B.id] };
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConflictException);
    expect(codeOf(error)).toBe('PROPERTY_CONTEXT_REQUIRED');
  });

  it('zeroPropertyAdmin (propertyIds: []) -> PROPERTY_ACCESS_DENIED, even with an explicit selector', () => {
    const actor = { propertyIds: [] as readonly string[] };
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, PROPERTY_A.id);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(codeOf(error)).toBe('PROPERTY_ACCESS_DENIED');
  });

  it('undefined propertyIds is treated identically to an empty array (safe deny default)', () => {
    const actor = {};
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(codeOf(error)).toBe('PROPERTY_ACCESS_DENIED');
  });

  it('superAdmin (propertyIds: ALL) -> allowed for A and B without any membership row', () => {
    const actor = { propertyIds: 'ALL' as const };
    expect(resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, PROPERTY_A.id)).toBe(PROPERTY_A);
    expect(resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, PROPERTY_B.id)).toBe(PROPERTY_B);
  });

  it('superAdmin with no explicit selector and two active properties -> PROPERTY_CONTEXT_REQUIRED', () => {
    const actor = { propertyIds: 'ALL' as const };
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConflictException);
    expect(codeOf(error)).toBe('PROPERTY_CONTEXT_REQUIRED');
  });

  it('superAdmin with no explicit selector and exactly one active property -> resolves it', () => {
    const actor = { propertyIds: 'ALL' as const };
    expect(resolveAuthorizedProperty(actor, [PROPERTY_A])).toBe(PROPERTY_A);
  });

  it('existence-leakage check: requested property id does not exist among active properties -> PROPERTY_NOT_FOUND, not FORBIDDEN', () => {
    const actor = { propertyIds: 'ALL' as const };
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, ACTIVE_PROPERTIES, HOSTILE_UUID);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(NotFoundException);
    expect(codeOf(error)).toBe('PROPERTY_NOT_FOUND');
  });

  it('no active properties at all and no explicit selector -> PropertyContextError', () => {
    const actor = { propertyIds: [PROPERTY_A.id] };
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, []);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(PropertyContextError);
  });

  it('authorized property id is not among the currently active properties (e.g. archived) -> PropertyContextError', () => {
    const actor = { propertyIds: [PROPERTY_A.id] };
    let error: unknown;
    try {
      resolveAuthorizedProperty(actor, [PROPERTY_B]);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(PropertyContextError);
  });
});
