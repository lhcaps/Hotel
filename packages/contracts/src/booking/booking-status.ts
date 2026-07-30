import { z } from 'zod';

const bookingCodeSchema = z
  .string()
  .trim()
  .min(8)
  .max(32)
  .regex(/^[A-Z0-9-]+$/)
  .transform((value) => value.toUpperCase());

const emailSchema = z.string().trim().email().max(254).toLowerCase();

export const bookingHoldStatusRequestSchema = z
  .object({
    bookingCode: bookingCodeSchema,
    email: emailSchema,
  })
  .strict();

export const bookingHoldStatusResponseSchema = z
  .object({
    status: z.enum(['HOLD', 'EXPIRED', 'UNKNOWN']),
    holdExpiresAt: z.string().datetime({ offset: true }).nullable(),
    serverTime: z.string().datetime({ offset: true }),
  })
  .strict();

export type BookingHoldStatusRequest = z.infer<typeof bookingHoldStatusRequestSchema>;
export type BookingHoldStatusResponse = z.infer<typeof bookingHoldStatusResponseSchema>;
