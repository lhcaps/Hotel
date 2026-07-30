import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  guestAccessOtpRequestResponseSchema,
  guestAccessOtpRequestSchema,
  guestAccessOtpVerifyResponseSchema,
  guestAccessOtpVerifySchema,
} from '../src/index.js';

describe('OTP schema parity between runtime and JSON schema', () => {
  it('accepts a canonical OTP request payload at runtime and rejects unsafe inputs', () => {
    expect(() =>
      guestAccessOtpRequestSchema.parse({ bookingCode: 'A1B2C3D4', email: 'a@b.test' }),
    ).not.toThrow();
    expect(() =>
      guestAccessOtpRequestSchema.parse({
        bookingCode: 'A1B2C3D4',
        email: 'a@b.test',
        sessionToken: 'sneak',
      }),
    ).toThrow();
  });

  it('accepts a canonical OTP verify payload at runtime', () => {
    expect(() =>
      guestAccessOtpVerifySchema.parse({
        challengeRef: '123456789ABCDEFGHJKMNPQRSTUVWXYZ',
        otp: '123456',
      }),
    ).not.toThrow();
    expect(() =>
      guestAccessOtpVerifySchema.parse({
        challengeRef: '123456789ABCDEFGHJKMNPQRSTUVWXYZ',
        otp: '12345',
      }),
    ).toThrow();
    expect(() =>
      guestAccessOtpVerifySchema.parse({
        challengeRef: '123456789ABCDEFGHJKMNPQRSTUVWXYZ',
        otp: '123456',
        sessionToken: 'sneak',
      }),
    ).toThrow();
  });

  it('emits a JSON schema that still rejects unsafe inputs via z.toJSONSchema', () => {
    const requestJson = z.toJSONSchema(guestAccessOtpRequestSchema, { io: 'input' });
    expect(requestJson.type).toBe('object');
    expect((requestJson as { required?: string[] }).required).toEqual(
      expect.arrayContaining(['bookingCode', 'email']),
    );

    const verifyJson = z.toJSONSchema(guestAccessOtpVerifySchema, { io: 'input' });
    expect(verifyJson.type).toBe('object');
    expect((verifyJson as { required?: string[] }).required).toEqual(
      expect.arrayContaining(['challengeRef', 'otp']),
    );
  });

  it('response schemas have only the documented public keys', () => {
    expect(Object.keys(guestAccessOtpRequestResponseSchema.shape).sort()).toEqual([
      'challengeRef',
      'cooldownSeconds',
      'expiresAt',
      'serverTime',
    ]);
    expect(Object.keys(guestAccessOtpVerifyResponseSchema.shape).sort()).toEqual([
      'bookingCode',
      'expiresAt',
      'issuedAt',
    ]);
  });
});
