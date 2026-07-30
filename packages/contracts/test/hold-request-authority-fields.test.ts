import { describe, expect, it } from 'vitest';

import {
  bookingHoldResponseSchema,
  createBookingHoldRequestSchema,
  guestAccessOtpRequestSchema,
  guestAccessOtpVerifyResponseSchema,
  guestAccessOtpVerifySchema,
  guestLogoutResponseSchema,
  bookingHoldStatusRequestSchema,
  bookingHoldStatusResponseSchema,
  guestAccessOtpRequestResponseSchema,
  bookingDetailResponseSchema,
} from '../src/index.js';

const REQUEST_FORBIDDEN_FIELDS = [
  'amount',
  'currency',
  'roomId',
  'roomNumber',
  'roomTypeId',
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

const RESPONSE_FORBIDDEN_FIELDS = [
  'amount',
  'roomId',
  'roomNumber',
  'bookingStatus',
  'pricingRuleVersion',
  'priceSnapshot',
  'role',
  'sessionToken',
  'session_token',
  'rawToken',
] as const;

const REQUEST_SCHEMAS = [
  {
    label: 'createBookingHoldRequestSchema',
    schema: createBookingHoldRequestSchema,
    base: { contact: { fullName: 'X', email: 'a@b.test', phone: '+84909000099' } },
  },
  {
    label: 'guestAccessOtpRequestSchema',
    schema: guestAccessOtpRequestSchema,
    base: { bookingCode: 'A1B2C3D4', email: 'a@b.test' },
  },
  {
    label: 'guestAccessOtpVerifySchema',
    schema: guestAccessOtpVerifySchema,
    base: { challengeRef: '123456789ABCDEFGHJKMNPQRSTUVWXYZ', otp: '123456' },
  },
  {
    label: 'bookingHoldStatusRequestSchema',
    schema: bookingHoldStatusRequestSchema,
    base: { bookingCode: 'A1B2C3D4', email: 'a@b.test' },
  },
] as const;

const RESPONSE_KEYS: ReadonlyArray<{ label: string; keys: string[] }> = [
  { label: 'bookingHoldResponseSchema', keys: Object.keys(bookingHoldResponseSchema.shape) },
  {
    label: 'guestAccessOtpRequestResponseSchema',
    keys: Object.keys(guestAccessOtpRequestResponseSchema.shape),
  },
  {
    label: 'guestAccessOtpVerifyResponseSchema',
    keys: Object.keys(guestAccessOtpVerifyResponseSchema.shape),
  },
  { label: 'bookingDetailResponseSchema', keys: Object.keys(bookingDetailResponseSchema.shape) },
  {
    label: 'bookingHoldStatusResponseSchema',
    keys: Object.keys(bookingHoldStatusResponseSchema.shape),
  },
  { label: 'guestLogoutResponseSchema', keys: Object.keys(guestLogoutResponseSchema.shape) },
];

describe('HOLD request authority-field rejection', () => {
  for (const { label, schema, base } of REQUEST_SCHEMAS) {
    for (const field of REQUEST_FORBIDDEN_FIELDS) {
      it(`${label} rejects an extra top-level field "${field}"`, () => {
        const tampered = { ...base, [field]: 'attacker' };
        expect(() => schema.parse(tampered)).toThrow();
      });
    }
  }
});

describe('response keys do not include any forbidden authority field', () => {
  for (const { label, keys } of RESPONSE_KEYS) {
    for (const field of RESPONSE_FORBIDDEN_FIELDS) {
      it(`${label} does not include "${field}"`, () => {
        expect(keys, `${label} contains forbidden field "${field}"`).not.toContain(field);
      });
    }
  }
});
