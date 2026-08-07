import { z } from 'zod';

import { cancellationPolicySchema, quoteSchema } from './pricing.js';

const instantSchema = z.string().datetime({ offset: true });
const bookingStatusSchema = z.enum([
  'HOLD',
  'CONFIRMED',
  'EXPIRED',
  'CANCELLED',
  'NO_SHOW',
  'CHECKED_IN',
  'CHECKED_OUT',
]);

export const customerBookingOfferSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(160),
  })
  .strict();

export const customerCancellationPolicySchema = cancellationPolicySchema;

export const customerBookingDetailSchema = z
  .object({
    bookingId: z.uuid(),
    bookingCode: z.string().trim().min(1).max(64),
    status: bookingStatusSchema,
    checkIn: instantSchema,
    checkOut: instantSchema,
    currency: z.literal('VND'),
    grossAmountVnd: z.string().regex(/^\d+$/),
    discountAmountVnd: z.string().regex(/^\d+$/),
    finalAmountVnd: z.string().regex(/^\d+$/),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
    stayMode: z.enum(['hourly', 'overnight', 'multi_night']).optional(),
    nightCount: z.number().int().min(1).max(31).nullable().optional(),
    pricingRuleVersion: z.string().trim().min(1).max(120).nullable().optional(),
    paymentStatus: z.enum([
      'NONE',
      'PENDING',
      'SUCCEEDED',
      'REVIEW_REQUIRED',
      'CANCELLED',
      'EXPIRED',
    ]),
    roomType: z.object({ id: z.uuid(), name: z.string().trim().min(1).max(160) }).strict(),
    offer: customerBookingOfferSchema.nullable(),
    cancellationPolicy: customerCancellationPolicySchema.nullable(),
    cancellationRefundState: z
      .enum(['NO_REFUND', 'REVIEW_REQUIRED', 'REFUND_PENDING', 'REFUNDED'])
      .nullable(),
    cancellationRefundAmountVnd: z.string().regex(/^\d+$/).nullable(),
    cancellationRetainedAmountVnd: z.string().regex(/^\d+$/).nullable(),
    createdAt: instantSchema,
  })
  .strict();

export const customerCancellationPreviewSchema = z
  .object({
    bookingCode: z.string().trim().min(1).max(64),
    bookingStatus: bookingStatusSchema,
    eligible: z.boolean(),
    outcome: z.enum(['NO_CHARGE', 'REVIEW_REQUIRED', 'NO_REFUND', 'NOT_ELIGIBLE']),
    estimatedRefundVnd: z.string().regex(/^\d+$/),
    paidAmountVnd: z.string().regex(/^\d+$/),
    retainedAmountVnd: z.string().regex(/^\d+$/),
    refundPercent: z.union([z.literal(0), z.literal(50), z.literal(100)]),
    refundBasis: z.literal('PAID_AMOUNT'),
    policy: customerCancellationPolicySchema.nullable(),
    policyMessage: z.string().trim().min(1).max(400),
  })
  .strict();

export const customerCancellationRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const customerCancellationResponseSchema = z
  .object({
    bookingCode: z.string().trim().min(1).max(64),
    status: bookingStatusSchema,
    refundState: z.enum(['NO_REFUND', 'REVIEW_REQUIRED', 'REFUND_PENDING', 'REFUNDED']),
    refundAmountVnd: z.string().regex(/^\d+$/),
    retainedAmountVnd: z.string().regex(/^\d+$/),
    idempotent: z.boolean(),
  })
  .strict();

export const customerAlterationPreviewRequestSchema = z
  .object({
    checkIn: instantSchema,
    checkOut: instantSchema,
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
    selectedPlanCode: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Z0-9_]+$/)
      .optional(),
  })
  .strict();

export const customerAlterationPreviewSchema = z
  .object({
    bookingCode: z.string().trim().min(1).max(64),
    eligible: z.boolean(),
    currentFinalAmountVnd: z.string().regex(/^\d+$/),
    quote: quoteSchema.nullable(),
    policyMessage: z.string().trim().min(1).max(400),
  })
  .strict();

export type CustomerBookingDetail = z.infer<typeof customerBookingDetailSchema>;
export type CustomerCancellationPolicy = z.infer<typeof customerCancellationPolicySchema>;
export type CustomerCancellationPreview = z.infer<typeof customerCancellationPreviewSchema>;
export type CustomerCancellationRequest = z.infer<typeof customerCancellationRequestSchema>;
export type CustomerCancellationResponse = z.infer<typeof customerCancellationResponseSchema>;
export type CustomerAlterationPreviewRequest = z.infer<
  typeof customerAlterationPreviewRequestSchema
>;
export type CustomerAlterationPreview = z.infer<typeof customerAlterationPreviewSchema>;
