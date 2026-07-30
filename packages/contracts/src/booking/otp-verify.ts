import { z } from 'zod';

const challengeRefSchema = z
  .string()
  .trim()
  .length(32)
  .regex(/^[1-9A-HJKMNP-Z]{32}$/, 'challengeRef must be 32 uppercase letters/digits excluding 0,I,L,O')
  .transform((value) => value.toUpperCase());

const otpSchema = z.string().regex(/^[0-9]{6}$/, 'otp must be exactly six digits');

export const guestAccessOtpVerifySchema = z
  .object({
    challengeRef: challengeRefSchema,
    otp: otpSchema,
  })
  .strict();

export const guestAccessOtpVerifyResponseSchema = z
  .object({
    bookingCode: z.string().regex(/^[A-Z0-9-]{4,32}$/),
    expiresAt: z.string().datetime({ offset: true }),
    issuedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type GuestAccessOtpVerify = z.infer<typeof guestAccessOtpVerifySchema>;
export type GuestAccessOtpVerifyResponse = z.infer<typeof guestAccessOtpVerifyResponseSchema>;