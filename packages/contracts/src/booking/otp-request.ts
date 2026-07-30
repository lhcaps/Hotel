import { z } from 'zod';

const bookingCodeRequestSchema = z
  .string()
  .trim()
  .min(8)
  .max(32)
  .regex(/^[A-Z0-9-]+$/, 'bookingCode must be uppercase letters, digits, or dashes')
  .transform((value) => value.toUpperCase());

const emailRequestSchema = z.string().trim().email().max(254).toLowerCase();

export const guestAccessOtpRequestSchema = z
  .object({
    bookingCode: bookingCodeRequestSchema,
    email: emailRequestSchema,
  })
  .strict();

export const guestAccessOtpRequestResponseSchema = z
  .object({
    challengeRef: z.string().regex(/^[1-9A-HJKMNP-Z]{32}$/),
    expiresAt: z.string().datetime({ offset: true }),
    cooldownSeconds: z.number().int().min(0).max(3600),
    serverTime: z.string().datetime({ offset: true }),
  })
  .strict();

export type GuestAccessOtpRequest = z.infer<typeof guestAccessOtpRequestSchema>;
export type GuestAccessOtpRequestResponse = z.infer<typeof guestAccessOtpRequestResponseSchema>;