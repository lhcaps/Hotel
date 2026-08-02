import { z } from 'zod';

export const paymentStatusResponseSchema = z.object({
  provider: z.enum(['MOMO', 'VNPAY']).nullable(),
  paymentStatus: z
    .enum(['PENDING', 'SUCCEEDED', 'REVIEW_REQUIRED', 'CANCELLED', 'EXPIRED'])
    .nullable(),
  attemptStatus: z
    .enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REVIEW_REQUIRED', 'EXPIRED', 'CANCELLED'])
    .nullable(),
  bookingStatus: z.enum([
    'HOLD',
    'CONFIRMED',
    'EXPIRED',
    'CANCELLED',
    'NO_SHOW',
    'CHECKED_IN',
    'CHECKED_OUT',
  ]),
  amountVnd: z.number().int().nonnegative(),
  currency: z.literal('VND'),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  reviewRequired: z.boolean(),
  customerMessage: z.string().max(300).nullable(),
});

export type PaymentStatusResponse = z.infer<typeof paymentStatusResponseSchema>;
