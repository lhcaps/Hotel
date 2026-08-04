import { z } from 'zod';

const uuidSchema = z.uuid();
const bookingCodeSchema = z.string().regex(/^[A-Z0-9-]{4,32}$/);
const instantSchema = z.string().datetime({ offset: true });

export const bookingStatusSchema = z.enum([
  'HOLD',
  'CONFIRMED',
  'EXPIRED',
  'CANCELLED',
  'NO_SHOW',
  'CHECKED_IN',
  'CHECKED_OUT',
]);

export const paymentStatusSummarySchema = z.enum([
  'NONE',
  'PENDING',
  'SUCCEEDED',
  'REVIEW_REQUIRED',
  'CANCELLED',
  'EXPIRED',
]);

export const reviewPresenceSchema = z.enum(['OPEN', 'RESOLVED', 'NONE']);

export const adminBookingActionSchema = z.enum(['cancel', 'check-in', 'check-out', 'no-show']);

export const adminBookingAccessPassScanRequestSchema = z
  .object({
    value: z.string().trim().min(16).max(4_096),
  })
  .strict();

export const adminBookingAccessPassScanResponseSchema = z
  .object({
    bookingCode: bookingCodeSchema,
    status: bookingStatusSchema,
    action: z.enum(['check-in', 'check-out']),
  })
  .strict();

export const adminBookingListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().min(1).max(64).optional(),
    status: bookingStatusSchema.optional(),
    paymentStatus: paymentStatusSummarySchema.optional(),
    customerUserId: uuidSchema.optional(),
    roomTypeId: uuidSchema.optional(),
    checkInFrom: instantSchema.optional(),
    checkInTo: instantSchema.optional(),
    reviewPresence: z.enum(['open', 'resolved', 'none']).optional(),
  })
  .strict();

export const adminBookingSummarySchema = z
  .object({
    bookingCode: bookingCodeSchema,
    status: bookingStatusSchema,
    checkIn: instantSchema,
    checkOut: instantSchema,
    roomType: z
      .object({
        id: uuidSchema,
        code: z.string().min(1).max(64),
        name: z.string().min(1).max(200),
      })
      .strict(),
    room: z
      .object({
        id: uuidSchema,
        roomNumber: z.string().min(1).max(64),
      })
      .strict()
      .nullable(),
    guestName: z.string().min(1).max(160),
    finalAmountVnd: z.number().int().min(0),
    currency: z.literal('VND'),
    paymentStatus: paymentStatusSummarySchema,
    reviewPresence: reviewPresenceSchema,
    createdAt: instantSchema,
  })
  .strict();

export const adminBookingListResponseSchema = z
  .object({
    items: z.array(adminBookingSummarySchema).readonly(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().min(0),
  })
  .strict();

export const adminBookingContactSchema = z
  .object({
    fullName: z.string().min(1).max(160),
    emailMasked: z.string().min(3).max(254),
    phoneMasked: z.string().min(3).max(32),
  })
  .strict();

export const adminBookingPricingSchema = z
  .object({
    grossAmountVnd: z.number().int().min(0),
    discountAmountVnd: z.number().int().min(0),
    finalAmountVnd: z.number().int().min(0),
    currency: z.literal('VND'),
    coupon: z
      .object({
        code: z.string().min(1).max(64),
        discountType: z.enum(['FIXED', 'PERCENTAGE']),
        grossAmountVnd: z.number().int().min(0),
        discountAmountVnd: z.number().int().min(0),
        finalAmountVnd: z.number().int().min(0),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const adminBookingPaymentSummarySchema = z
  .object({
    status: paymentStatusSummarySchema,
    amountVnd: z.number().int().min(0),
    confirmationSource: z.enum(['PROVIDER_EVENT', 'NO_CHARGE']).nullable(),
    succeededAt: instantSchema.nullable(),
  })
  .strict();

export const adminBookingOperationalReviewSchema = z
  .object({
    reviewId: uuidSchema,
    category: z.enum(['PAID_CANCELLATION']),
    status: z.enum(['OPEN', 'RESOLVED']),
    openedAt: instantSchema,
    openedReason: z.string().min(1).max(1_000),
    resolvedAt: instantSchema.nullable(),
    resolvedNote: z.string().min(1).max(2_000).nullable(),
  })
  .strict();

export const adminBookingTimelineEntrySchema = z
  .object({
    id: uuidSchema,
    eventType: z.string().min(1).max(120),
    actorType: z.enum(['GUEST', 'CUSTOMER', 'ADMIN', 'SYSTEM']),
    actorId: uuidSchema.nullable(),
    occurredAt: instantSchema,
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export const adminBookingDetailSchema = z
  .object({
    bookingCode: bookingCodeSchema,
    status: bookingStatusSchema,
    property: z
      .object({
        code: z.string().min(1).max(64),
        name: z.string().min(1).max(200),
        timezone: z.string().min(1).max(64),
      })
      .strict(),
    contact: adminBookingContactSchema,
    occupancy: z
      .object({
        adults: z.number().int().min(1).max(16),
        children: z.number().int().min(0).max(16),
      })
      .strict(),
    roomType: z
      .object({
        id: uuidSchema,
        code: z.string().min(1).max(64),
        name: z.string().min(1).max(200),
        maxOccupancy: z.number().int().min(1).max(32),
      })
      .strict(),
    room: z
      .object({
        id: uuidSchema,
        roomNumber: z.string().min(1).max(64),
      })
      .strict()
      .nullable(),
    interval: z
      .object({
        checkIn: instantSchema,
        checkOut: instantSchema,
      })
      .strict(),
    pricing: adminBookingPricingSchema,
    payment: adminBookingPaymentSummarySchema,
    operationalReview: adminBookingOperationalReviewSchema.nullable(),
    timeline: z.array(adminBookingTimelineEntrySchema).readonly(),
    availableActions: z.array(adminBookingActionSchema).readonly(),
    serverTime: instantSchema,
  })
  .strict();

export const adminBookingCancelRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const adminBookingNoShowRequestSchema = adminBookingCancelRequestSchema;

export const adminBookingActionRequestSchema = z.object({}).strict();

export const adminOperationalReviewListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['OPEN', 'RESOLVED']).default('OPEN'),
    bookingCode: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const adminOperationalReviewSummarySchema = z
  .object({
    reviewId: uuidSchema,
    bookingCode: bookingCodeSchema,
    bookingStatus: bookingStatusSchema,
    category: z.enum(['PAID_CANCELLATION']),
    status: z.enum(['OPEN', 'RESOLVED']),
    openedAt: instantSchema,
    openedReason: z.string().min(1).max(1_000),
    resolvedAt: instantSchema.nullable(),
    paymentStatus: paymentStatusSummarySchema,
    amountVnd: z.number().int().min(0),
  })
  .strict();

export const adminOperationalReviewListResponseSchema = z
  .object({
    items: z.array(adminOperationalReviewSummarySchema).readonly(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().min(0),
  })
  .strict();

export const adminOperationalReviewDetailSchema = adminOperationalReviewSummarySchema
  .extend({
    booking: z
      .object({
        bookingCode: bookingCodeSchema,
        status: bookingStatusSchema,
        checkIn: instantSchema,
        checkOut: instantSchema,
        roomType: z.object({ code: z.string(), name: z.string() }).strict(),
        room: z.object({ id: uuidSchema, roomNumber: z.string() }).strict().nullable(),
        finalAmountVnd: z.number().int().min(0),
      })
      .strict(),
    payment: adminBookingPaymentSummarySchema,
    timeline: z.array(adminBookingTimelineEntrySchema).readonly(),
    serverTime: instantSchema,
  })
  .strict();

export const adminOperationalReviewResolveRequestSchema = z
  .object({
    note: z.string().trim().min(1).max(2_000),
  })
  .strict();

export type AdminBookingListQuery = z.infer<typeof adminBookingListQuerySchema>;
export type AdminBookingListResponse = z.infer<typeof adminBookingListResponseSchema>;
export type AdminBookingSummary = z.infer<typeof adminBookingSummarySchema>;
export type AdminBookingDetail = z.infer<typeof adminBookingDetailSchema>;
export type AdminBookingAction = z.infer<typeof adminBookingActionSchema>;
export type AdminBookingAccessPassScanRequest = z.infer<
  typeof adminBookingAccessPassScanRequestSchema
>;
export type AdminBookingAccessPassScanResponse = z.infer<
  typeof adminBookingAccessPassScanResponseSchema
>;
export type AdminBookingCancelRequest = z.infer<typeof adminBookingCancelRequestSchema>;
export type AdminBookingNoShowRequest = z.infer<typeof adminBookingNoShowRequestSchema>;
export type AdminOperationalReviewListQuery = z.infer<typeof adminOperationalReviewListQuerySchema>;
export type AdminOperationalReviewListResponse = z.infer<
  typeof adminOperationalReviewListResponseSchema
>;
export type AdminOperationalReviewDetail = z.infer<typeof adminOperationalReviewDetailSchema>;
export type AdminOperationalReviewResolveRequest = z.infer<
  typeof adminOperationalReviewResolveRequestSchema
>;
