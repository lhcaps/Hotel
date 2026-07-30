import { describe, expect, it } from 'vitest';

import {
  CustomerProfileValidationError,
  parseCustomerProfilePatch,
} from '../../src/customer/customer-profile.schema.js';

describe('parseCustomerProfilePatch', () => {
  it('parses a minimal payload with just name', () => {
    const result = parseCustomerProfilePatch({ name: 'Customer One' });
    expect(result.name).toBe('Customer One');
    expect(result.countryCode).toBe('VN');
  });

  it('parses a full payload with E.164 phone and address fields', () => {
    const result = parseCustomerProfilePatch({
      name: 'Customer Two',
      phone: '+84901234567',
      addressLine1: '123 Le Loi',
      ward: 'Ben Nghe',
      district: 'District 1',
      province: 'Ho Chi Minh',
      countryCode: 'VN',
      postalCode: '700000',
    });
    expect(result.phone).toBe('+84901234567');
    expect(result.addressLine1).toBe('123 Le Loi');
    expect(result.countryCode).toBe('VN');
  });

  it('treats empty trimmed strings as null', () => {
    const result = parseCustomerProfilePatch({
      name: 'X',
      phone: '   ',
      addressLine1: '',
    });
    expect(result.phone).toBeNull();
    expect(result.addressLine1).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(() => parseCustomerProfilePatch('not an object')).toThrow(
      CustomerProfileValidationError,
    );
  });

  it('rejects missing name', () => {
    expect(() => parseCustomerProfilePatch({})).toThrow(/Name is required/);
  });

  it('rejects blank name', () => {
    expect(() => parseCustomerProfilePatch({ name: '   ' })).toThrow(
      CustomerProfileValidationError,
    );
  });

  it('rejects overly-long name', () => {
    expect(() => parseCustomerProfilePatch({ name: 'x'.repeat(121) })).toThrow(
      /Name must be 120 characters or fewer/,
    );
  });

  it('rejects invalid phone format', () => {
    expect(() => parseCustomerProfilePatch({ name: 'X', phone: '0901234567' })).toThrow(/E\.164/);
  });

  it('rejects invalid country code', () => {
    expect(() => parseCustomerProfilePatch({ name: 'X', countryCode: 'vietnam' })).toThrow(
      /2-letter ISO/,
    );
  });

  it('truncates oversize text fields to the documented maximums', () => {
    const longAddress = 'x'.repeat(250);
    const result = parseCustomerProfilePatch({ name: 'X', addressLine1: longAddress });
    expect(result.addressLine1?.length).toBe(200);
  });
});
