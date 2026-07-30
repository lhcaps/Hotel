import { describe, it, expect } from 'vitest';
import {
  normalizeContact,
  contactsAreEquivalent,
  maskEmailForDisplay,
  type ContactInput,
} from './contact.js';

const testDigestSecret = Buffer.from('test-secret-key-32-bytes-long!!');

describe('normalizeContact', () => {
  it('lowercases email and trims whitespace', () => {
    const input: ContactInput = {
      fullName: 'Nguyen Van A',
      email: '  NguyenVanA@EXAMPLE.COM  ',
      phone: '+84901234567',
    };

    const result = normalizeContact(input, testDigestSecret);
    expect(result.email).toBe('nguyenvana@example.com');
  });

  it('produces identical emailDigest for different case emails', () => {
    const input1: ContactInput = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '+84901234567',
    };

    const input2: ContactInput = {
      fullName: 'Test User',
      email: 'TEST@EXAMPLE.COM',
      phone: '+84901234567',
    };

    const result1 = normalizeContact(input1, testDigestSecret);
    const result2 = normalizeContact(input2, testDigestSecret);

    expect(result1.emailDigest.equals(result2.emailDigest)).toBe(true);
  });

  it('collapses internal whitespace in fullName', () => {
    const input: ContactInput = {
      fullName: '  Nguyen   Van   A  ',
      email: 'test@example.com',
      phone: '+84901234567',
    };

    const result = normalizeContact(input, testDigestSecret);
    expect(result.fullName).toBe('Nguyen Van A');
  });

  it('validates phone number has country code', () => {
    const input: ContactInput = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '0901234567', // missing +
    };

    expect(() => normalizeContact(input, testDigestSecret)).toThrow('Invalid phone number');
  });

  it('normalizes a valid international phone number to E.164 via libphonenumber-js', () => {
    const input: ContactInput = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '+84 90 123 4567',
    };

    const result = normalizeContact(input, testDigestSecret);
    expect(result.phoneE164).toBe('+84901234567');
  });

  it('normalizes a differently formatted but equivalent international number to the same E.164 value', () => {
    const input: ContactInput = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '+1 (202) 555-0143',
    };

    const result = normalizeContact(input, testDigestSecret);
    expect(result.phoneE164).toBe('+12025550143');
  });

  it('throws on a syntactically invalid phone number', () => {
    const input: ContactInput = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890123456789',
    };

    expect(() => normalizeContact(input, testDigestSecret)).toThrow('Invalid phone number');
  });

  it('throws on a malformed, non-numeric phone number', () => {
    const input: ContactInput = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '+not-a-phone',
    };

    expect(() => normalizeContact(input, testDigestSecret)).toThrow('Invalid phone number');
  });

  it('throws on ambiguous number lacking an explicit country code', () => {
    const input: ContactInput = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '901234567', // no + prefix, no country code
    };

    expect(() => normalizeContact(input, testDigestSecret)).toThrow('Invalid phone number');
  });

  it('throws on invalid email', () => {
    const input: ContactInput = {
      fullName: 'Test User',
      email: 'invalid-email',
      phone: '+84901234567',
    };

    expect(() => normalizeContact(input, testDigestSecret)).toThrow('Invalid email address');
  });
});

describe('contactsAreEquivalent', () => {
  it('returns true for two normalized contacts with identical fields', () => {
    const input: ContactInput = {
      fullName: 'Nguyen Van A',
      email: 'test@example.com',
      phone: '+84901234567',
    };

    const contact1 = normalizeContact(input, testDigestSecret);
    const contact2 = normalizeContact(input, testDigestSecret);

    expect(contactsAreEquivalent(contact1, contact2)).toBe(true);
  });

  it('returns false for different emails', () => {
    const contact1 = normalizeContact(
      {
        fullName: 'Test User',
        email: 'test1@example.com',
        phone: '+84901234567',
      },
      testDigestSecret,
    );

    const contact2 = normalizeContact(
      {
        fullName: 'Test User',
        email: 'test2@example.com',
        phone: '+84901234567',
      },
      testDigestSecret,
    );

    expect(contactsAreEquivalent(contact1, contact2)).toBe(false);
  });
});

describe('maskEmailForDisplay', () => {
  it('masks middle characters of email local part', () => {
    expect(maskEmailForDisplay('nguyenvana@example.com')).toBe('n********a@example.com');
  });

  it('handles short email addresses', () => {
    expect(maskEmailForDisplay('ab@example.com')).toBe('ab@example.com');
  });

  it('handles single character local part', () => {
    expect(maskEmailForDisplay('a@example.com')).toBe('a@example.com');
  });
});
