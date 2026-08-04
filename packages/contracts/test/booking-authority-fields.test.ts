import { describe, expect, it } from 'vitest';

import {
  bookingHoldResponseSchema,
  createBookingHoldRequestSchema,
  guestAccessOtpRequestSchema,
  guestAccessOtpRequestResponseSchema,
  guestAccessOtpVerifyResponseSchema,
  guestAccessOtpVerifySchema,
  guestLogoutResponseSchema,
  bookingDetailResponseSchema,
  bookingHoldStatusRequestSchema,
  bookingHoldStatusResponseSchema,
} from '../src/index.js';

const CLIENT_AUTHORITATIVE_FIELDS = [
  'amount',
  'amountVnd',
  'totalAmountVnd',
  'currency',
  'roomId',
  'roomNumber',
  'roomTypeId',
  'roomTypeOverride',
  'bookingStatus',
  'status',
  'holdExpiresAt',
  'pricingRuleVersion',
  'priceSnapshot',
  'role',
  'sessionToken',
  'session_token',
  'rawToken',
] as const;

const validContact = {
  fullName: 'Phase Five Guest',
  email: 'guest@phase5.test',
  phone: '+84909000099',
};

const validHoldRequest = { contact: validContact };

const validOtpRequest = {
  bookingCode: 'A1B2C3D4',
  email: 'guest@phase5.test',
};

const validOtpVerify = {
  challengeRef: '123456789ABCDEFGHJKMNPQRSTUVWXYZ',
  otp: '123456',
};

const validBookingCode = 'A1B2C3D4';
const validEmail = 'guest@phase5.test';

describe('Phase 5 contract authority-field rejection', () => {
  describe('createBookingHoldRequestSchema', () => {
    it('accepts the canonical contact-only payload', () => {
      expect(() => createBookingHoldRequestSchema.parse(validHoldRequest)).not.toThrow();
    });

    it('accepts a Vietnamese local phone and normalizes it to E.164', () => {
      const parsed = createBookingHoldRequestSchema.parse({
        contact: { ...validContact, phone: '0909000099' },
      });
      expect(parsed.contact.phone).toBe('+84909000099');
    });

    for (const field of CLIENT_AUTHORITATIVE_FIELDS) {
      it(`rejects an injected top-level field "${field}"`, () => {
        const tampered = { ...validHoldRequest, [field]: 'attacker' };
        expect(() => createBookingHoldRequestSchema.parse(tampered)).toThrow();
      });
    }

    for (const field of CLIENT_AUTHORITATIVE_FIELDS) {
      it(`rejects an injected field "${field}" inside the contact object`, () => {
        const tampered = {
          contact: { ...validContact, [field]: 'attacker' },
        };
        expect(() => createBookingHoldRequestSchema.parse(tampered)).toThrow();
      });
    }
  });

  describe('guestAccessOtpRequestSchema', () => {
    it('accepts the canonical request payload', () => {
      expect(() => guestAccessOtpRequestSchema.parse(validOtpRequest)).not.toThrow();
    });

    for (const field of CLIENT_AUTHORITATIVE_FIELDS) {
      it(`rejects an injected top-level field "${field}"`, () => {
        const tampered = { ...validOtpRequest, [field]: 'attacker' };
        expect(() => guestAccessOtpRequestSchema.parse(tampered)).toThrow();
      });
    }
  });

  describe('guestAccessOtpVerifySchema', () => {
    it('accepts the canonical verify payload', () => {
      expect(() => guestAccessOtpVerifySchema.parse(validOtpVerify)).not.toThrow();
    });

    for (const field of CLIENT_AUTHORITATIVE_FIELDS) {
      it(`rejects an injected field "${field}"`, () => {
        const tampered = { ...validOtpVerify, [field]: 'attacker' };
        expect(() => guestAccessOtpVerifySchema.parse(tampered)).toThrow();
      });
    }
  });

  describe('bookingHoldStatusRequestSchema', () => {
    it('accepts the canonical status payload', () => {
      expect(() =>
        bookingHoldStatusRequestSchema.parse({
          bookingCode: validBookingCode,
          email: validEmail,
        }),
      ).not.toThrow();
    });

    for (const field of CLIENT_AUTHORITATIVE_FIELDS) {
      it(`rejects an injected field "${field}"`, () => {
        const tampered = {
          bookingCode: validBookingCode,
          email: validEmail,
          [field]: 'attacker',
        };
        expect(() => bookingHoldStatusRequestSchema.parse(tampered)).toThrow();
      });
    }
  });

  describe('response schemas never expose client-authoritative write fields', () => {
    it('bookingHoldResponseSchema does not include role/sessionToken/priceSnapshot keys', () => {
      const keys = Object.keys(bookingHoldResponseSchema.shape).sort();
      expect(keys).toEqual([
        'amountVnd',
        'bookingCode',
        'bookingId',
        'checkIn',
        'checkOut',
        'coupon',
        'currency',
        'holdExpiresAt',
        'idempotent',
        'status',
      ]);
      expect(keys).not.toContain('sessionToken');
      expect(keys).not.toContain('rawToken');
      expect(keys).not.toContain('priceSnapshot');
      expect(keys).not.toContain('role');
    });

    it('guestAccessOtpRequestResponseSchema does not include any session/token fields', () => {
      const keys = Object.keys(guestAccessOtpRequestResponseSchema.shape).sort();
      expect(keys).toEqual(['challengeRef', 'cooldownSeconds', 'expiresAt', 'serverTime']);
      expect(keys).not.toContain('sessionToken');
      expect(keys).not.toContain('rawToken');
    });

    it('guestAccessOtpVerifyResponseSchema does not include any session/token fields', () => {
      const keys = Object.keys(guestAccessOtpVerifyResponseSchema.shape).sort();
      expect(keys).toEqual(['bookingCode', 'expiresAt', 'issuedAt']);
      expect(keys).not.toContain('sessionToken');
      expect(keys).not.toContain('rawToken');
    });

    it('bookingDetailResponseSchema exposes masked contact only', () => {
      const contactShape = bookingDetailResponseSchema.shape.contact.shape;
      const contactKeys = Object.keys(contactShape).sort();
      expect(contactKeys).toEqual(['emailMasked', 'fullName', 'phoneMasked']);
      expect(Object.keys(bookingDetailResponseSchema.shape).sort()).toEqual([
        'adults',
        'amountVnd',
        'bookingCode',
        'checkIn',
        'checkOut',
        'children',
        'contact',
        'coupon',
        'currency',
        'holdExpiresAt',
        'property',
        'roomType',
        'serverTime',
        'status',
      ]);
    });

    it('bookingHoldStatusResponseSchema does not include amount or pricing fields', () => {
      const keys = Object.keys(bookingHoldStatusResponseSchema.shape).sort();
      expect(keys).toEqual(['holdExpiresAt', 'serverTime', 'status']);
      expect(keys).not.toContain('amountVnd');
      expect(keys).not.toContain('priceSnapshot');
    });

    it('guestLogoutResponseSchema exposes only loggedOutAt', () => {
      const keys = Object.keys(guestLogoutResponseSchema.shape).sort();
      expect(keys).toEqual(['loggedOutAt']);
    });
  });
});
