import { z } from 'zod';
import { bookingHoldCouponSummarySchema } from './hold.js';
import { cancellationPolicySchema } from '../pricing.js';

const instantSchema = z.string().datetime({ offset: true });

export const bookingDetailResponseSchema = z
  .object({
    bookingCode: z.string().regex(/^[A-Z0-9-]{4,32}$/),
    status: z.enum([
      'HOLD',
      'CONFIRMED',
      'EXPIRED',
      'CANCELLED',
      'NO_SHOW',
      'CHECKED_IN',
      'CHECKED_OUT',
    ]),
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
    cancellationPolicy: cancellationPolicySchema.nullable(),
    coupon: bookingHoldCouponSummarySchema.optional(),
    serverTime: instantSchema,
  })
  .strict();

export type BookingDetailResponse = z.infer<typeof bookingDetailResponseSchema>;

export const bookingAccessPassResponseSchema = z
  .object({
    bookingCode: z.string().regex(/^[A-Z0-9-]{4,32}$/),
    expiresAt: instantSchema,
    svg: z.string().min(1),
    arrival: z
      .object({
        gatePass: z.string().trim().min(1).max(512),
        roomPass: z.string().trim().min(1).max(512),
        wifi: z
          .object({
            ssid: z.string().trim().min(1).max(2_000),
            password: z.string().trim().min(1).max(512),
          })
          .strict(),
        location: z.string().trim().min(1).max(2_000),
        instructions: z.string().trim().min(1).max(2_000),
        preparationNote: z.string().trim().min(1).max(2_000),
        supportContact: z.string().trim().min(1).max(2_000),
      })
      .strict(),
  })
  .strict();

export type BookingAccessPassResponse = z.infer<typeof bookingAccessPassResponseSchema>;
