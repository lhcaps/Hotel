import { z } from 'zod';

const instantSchema = z.string().datetime({ offset: true });
const catalogCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((value) => value.toUpperCase());

export const adminReportBookingStatusSchema = z.enum([
  'HOLD',
  'CONFIRMED',
  'EXPIRED',
  'CANCELLED',
  'NO_SHOW',
  'CHECKED_IN',
  'CHECKED_OUT',
]);

export const adminReportPaymentStatusSchema = z.enum([
  'NONE',
  'PENDING',
  'SUCCEEDED',
  'REVIEW_REQUIRED',
  'CANCELLED',
  'EXPIRED',
]);

export const adminOperationalReportQuerySchema = z
  .object({
    from: instantSchema,
    to: instantSchema,
    bookingStatuses: z.array(adminReportBookingStatusSchema).max(7).optional(),
    paymentStatuses: z.array(adminReportPaymentStatusSchema).max(6).optional(),
    ratePlanCodes: z.array(catalogCodeSchema).max(50).optional(),
    roomTierCodes: z.array(catalogCodeSchema).max(50).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Date(value.to).getTime() < new Date(value.from).getTime()) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'to must be greater than or equal to from.',
      });
    }
  });

export const adminOperationalReportSeriesPointSchema = z
  .object({
    date: z.string().date(),
    revenueVnd: z.number().int().nonnegative(),
    bookingCount: z.number().int().nonnegative(),
  })
  .strict();

export const adminOperationalReportBreakdownPointSchema = z
  .object({
    label: z.string().min(1).max(160),
    revenueVnd: z.number().int().nonnegative(),
    bookingCount: z.number().int().nonnegative(),
  })
  .strict();

export const adminOperationalReportSchema = z
  .object({
    grossRevenueVnd: z.number().int().nonnegative(),
    settledRevenueVnd: z.number().int().nonnegative(),
    outstandingRevenueVnd: z.null(),
    bookingCount: z.number().int().nonnegative(),
    confirmedCount: z.number().int().nonnegative(),
    cancellationCount: z.number().int().nonnegative(),
    paymentReviewCount: z.number().int().nonnegative(),
    customerCount: z.number().int().nonnegative(),
    returningCustomerCount: z.number().int().nonnegative(),
    daily: z.array(adminOperationalReportSeriesPointSchema).readonly(),
    ratePlans: z.array(adminOperationalReportBreakdownPointSchema).readonly(),
    roomTypes: z.array(adminOperationalReportBreakdownPointSchema).readonly(),
    generatedAt: instantSchema,
  })
  .strict();

export type AdminOperationalReportQuery = z.infer<typeof adminOperationalReportQuerySchema>;
export type AdminOperationalReport = z.infer<typeof adminOperationalReportSchema>;
