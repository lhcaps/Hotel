import { z } from 'zod';

const fullNameSchema = z.string().trim().min(1).max(160);
const emailSchema = z.string().trim().email().max(254).toLowerCase();
const phoneSchema = z
  .string()
  .trim()
  .min(8)
  .max(20)
  .regex(/^\+[1-9]\d{7,14}$/, 'phone must be in E.164 format (e.g. +84901234567)');
const instantSchema = z.string().datetime({ offset: true });
const amountVndSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const couponCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9-]{4,32}$/);

export const bookingHoldCouponSummarySchema = z
  .object({
    code: couponCodeSchema,
    discountType: z.enum(['FIXED', 'PERCENTAGE']),
    grossAmountVnd: amountVndSchema,
    discountAmountVnd: amountVndSchema,
    finalAmountVnd: amountVndSchema,
  })
  .strict();

export const createBookingHoldRequestSchema = z
  .object({
    contact: z
      .object({
        fullName: fullNameSchema,
        email: emailSchema,
        phone: phoneSchema,
      })
      .strict(),
  })
  .strict();

export const bookingHoldResponseSchema = z
  .object({
    bookingId: z.uuid(),
    bookingCode: z.string().regex(/^[A-Z0-9-]{4,32}$/),
    status: z.literal('HOLD'),
    checkIn: instantSchema,
    checkOut: instantSchema,
    holdExpiresAt: instantSchema,
    amountVnd: z.number().int().min(0),
    currency: z.literal('VND'),
    idempotent: z.boolean(),
    coupon: bookingHoldCouponSummarySchema.optional(),
  })
  .strict();

export type CreateBookingHoldRequest = z.infer<typeof createBookingHoldRequestSchema>;
export type BookingHoldResponse = z.infer<typeof bookingHoldResponseSchema>;
export type BookingHoldCouponSummary = z.infer<typeof bookingHoldCouponSummarySchema>;
