import { z } from 'zod';
import { bookingHoldCouponSummarySchema } from './hold.js';

const instantSchema = z.string().datetime({ offset: true });

export const bookingDetailResponseSchema = z
  .object({
    bookingCode: z.string().regex(/^[A-Z0-9-]{4,32}$/),
    status: z.enum(['HOLD', 'CONFIRMED', 'EXPIRED', 'CANCELLED']),
    property: z
      .object({
        code: z.string().regex(/^[A-Z0-9_-]{2,64}$/),
        name: z.string().min(1).max(200),
        timezone: z.string().min(1).max(64),
      })
      .strict(),
    roomType: z
      .object({
        code: z.string().regex(/^[A-Z0-9_-]{2,64}$/),
        name: z.string().min(1).max(200),
        maxOccupancy: z.number().int().min(1).max(32),
      })
      .strict(),
    checkIn: instantSchema,
    checkOut: instantSchema,
    adults: z.number().int().min(1).max(16),
    children: z.number().int().min(0).max(16),
    amountVnd: z.number().int().min(0),
    currency: z.literal('VND'),
    holdExpiresAt: instantSchema.nullable(),
    contact: z
      .object({
        fullName: z.string().min(1).max(160),
        emailMasked: z.string().min(3).max(254),
        phoneMasked: z.string().min(3).max(32),
      })
      .strict(),
    coupon: bookingHoldCouponSummarySchema.optional(),
    serverTime: instantSchema,
  })
  .strict();

export type BookingDetailResponse = z.infer<typeof bookingDetailResponseSchema>;
