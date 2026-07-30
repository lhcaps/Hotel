import { z } from 'zod';

const uuidSchema = z.uuid();
const bookingCodeSchema = z.string().regex(/^[A-Z0-9-]{4,32}$/);
const instantSchema = z.string().datetime({ offset: true });

export const adminPaymentListStatusSchema = z.enum([
  'PENDING',
  'SUCCEEDED',
  'REVIEW_REQUIRED',
  'CANCELLED',
  'EXPIRED',
]);

export const adminPaymentProviderFilterSchema = z.enum(['MOMO', 'VNPAY']);

export const adminPaymentListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: adminPaymentListStatusSchema.optional(),
    provider: adminPaymentProviderFilterSchema.optional(),
    bookingCode: z.string().trim().min(1).max(64).optional(),
    reviewRequired: z
      .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        return value === 'true' || value === '1';
      }),
    createdFrom: instantSchema.optional(),
    createdTo: instantSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.createdFrom !== undefined && value.createdTo !== undefined) {
      if (new Date(value.createdTo).getTime() < new Date(value.createdFrom).getTime()) {
        context.addIssue({
          code: 'custom',
          path: ['createdTo'],
          message: 'createdTo must be greater than or equal to createdFrom.',
        });
      }
    }
  });

export const adminPaymentReferenceSchema = z
  .object({
    bookingId: uuidSchema,
    bookingCode: bookingCodeSchema,
    bookingStatus: z.enum([
      'HOLD',
      'CONFIRMED',
      'EXPIRED',
      'CANCELLED',
      'NO_SHOW',
      'CHECKED_IN',
      'CHECKED_OUT',
    ]),
    finalAmountVnd: z.number().int().nonnegative(),
    currency: z.literal('VND'),
    contact: z
      .object({
        fullName: z.string().min(1).max(160),
        emailMasked: z.string().min(3).max(254),
        phoneMasked: z.string().min(3).max(32),
      })
      .strict(),
  })
  .strict();

export const adminPaymentAttemptRefSchema = z
  .object({
    paymentAttemptId: uuidSchema,
    provider: adminPaymentProviderFilterSchema,
    status: z.enum([
      'PENDING',
      'SUCCEEDED',
      'FAILED',
      'REVIEW_REQUIRED',
      'EXPIRED',
      'CANCELLED',
    ]),
    initiatedAt: instantSchema,
    completedAt: instantSchema.nullable(),
    amountVnd: z.number().int().nonnegative(),
    currency: z.literal('VND'),
    idempotencyKeyMasked: z.string().min(1).max(40),
    providerOrderIdMasked: z.string().min(1).max(40),
    providerTransactionIdMasked: z.string().min(1).max(40).nullable(),
  })
  .strict();

export const adminPaymentProviderRefSchema = z
  .object({
    provider: adminPaymentProviderFilterSchema,
    displayName: z.string().min(1).max(120),
    configured: z.boolean(),
    enabled: z.boolean(),
    environment: z.enum(['sandbox', 'production']),
    checkoutExpiryMinutes: z.number().int().min(1).max(60),
  })
  .strict();

export const adminPaymentEventSchema = z
  .object({
    id: uuidSchema,
    eventType: z.string().min(1).max(120),
    actorType: z.enum(['GUEST', 'CUSTOMER', 'ADMIN', 'SYSTEM', 'PROVIDER']),
    actorId: uuidSchema.nullable(),
    occurredAt: instantSchema,
    summary: z.string().min(1).max(280),
  })
  .strict();

export const adminPaymentReconciliationStateSchema = z
  .object({
    status: z.enum(['NOT_REQUESTED', 'IN_PROGRESS', 'COMPLETED', 'STALE']),
    requestedAt: instantSchema.nullable(),
    requestedBy: uuidSchema.nullable(),
    lastAttemptCount: z.number().int().min(0),
    lastErrorCode: z.string().min(1).max(80).nullable(),
    lastReconciledAt: instantSchema.nullable(),
    nextEligibleAt: instantSchema.nullable(),
    providerResponse: z.enum(['SUCCESS', 'STILL_PENDING', 'FAILED', 'REVIEW_REQUIRED']).nullable(),
  })
  .strict();

export const adminPaymentOperationalReviewSchema = z
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

export const adminPaymentAuditEntrySchema = z
  .object({
    id: uuidSchema,
    eventType: z.string().min(1).max(120),
    actorType: z.enum(['GUEST', 'CUSTOMER', 'ADMIN', 'SYSTEM']),
    actorId: uuidSchema.nullable(),
    occurredAt: instantSchema,
    summary: z.string().min(1).max(280),
  })
  .strict();

export const adminPaymentSummarySchema = z
  .object({
    paymentId: uuidSchema,
    status: adminPaymentListStatusSchema,
    amountVnd: z.number().int().nonnegative(),
    currency: z.literal('VND'),
    confirmationSource: z.enum(['PROVIDER_EVENT', 'NO_CHARGE']).nullable(),
    reviewRequired: z.boolean(),
    createdAt: instantSchema,
    updatedAt: instantSchema,
    completedAt: instantSchema.nullable(),
    provider: adminPaymentProviderFilterSchema.nullable(),
    booking: adminPaymentReferenceSchema,
    latestAttempt: adminPaymentAttemptRefSchema.nullable(),
    providerRef: adminPaymentProviderRefSchema.nullable(),
    operationalReview: adminPaymentOperationalReviewSchema.nullable(),
  })
  .strict();

export const adminPaymentListResponseSchema = z
  .object({
    items: z.array(adminPaymentSummarySchema).readonly(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().min(0),
  })
  .strict();

export const adminPaymentDetailSchema = z
  .object({
    paymentId: uuidSchema,
    status: adminPaymentListStatusSchema,
    amountVnd: z.number().int().nonnegative(),
    currency: z.literal('VND'),
    confirmationSource: z.enum(['PROVIDER_EVENT', 'NO_CHARGE']).nullable(),
    succeededAt: instantSchema.nullable(),
    reviewRequiredAt: instantSchema.nullable(),
    cancelledAt: instantSchema.nullable(),
    expiredAt: instantSchema.nullable(),
    createdAt: instantSchema,
    updatedAt: instantSchema,
    booking: adminPaymentReferenceSchema,
    providerRef: adminPaymentProviderRefSchema.nullable(),
    attempts: z.array(adminPaymentAttemptRefSchema).readonly(),
    timeline: z.array(adminPaymentEventSchema).readonly(),
    reconciliation: adminPaymentReconciliationStateSchema,
    operationalReview: adminPaymentOperationalReviewSchema.nullable(),
    audit: z.array(adminPaymentAuditEntrySchema).readonly(),
    serverTime: instantSchema,
  })
  .strict();

export const adminPaymentReconcileRequestSchema = z
  .object({
    note: z.string().trim().min(1).max(500).optional(),
    expectedAttemptId: uuidSchema.optional(),
    expectedUpdatedAt: instantSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expectedAttemptId === undefined && value.expectedUpdatedAt === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['expectedAttemptId'],
        message:
          'Provide expectedAttemptId or expectedUpdatedAt to guard against concurrent settlement writes.',
      });
    }
  });

export const adminPaymentReconcileResponseSchema = z
  .object({
    paymentId: uuidSchema,
    reconciliation: adminPaymentReconciliationStateSchema,
    payment: adminPaymentSummarySchema,
    serverTime: instantSchema,
  })
  .strict();

export type AdminPaymentListQuery = z.infer<typeof adminPaymentListQuerySchema>;
export type AdminPaymentListResponse = z.infer<typeof adminPaymentListResponseSchema>;
export type AdminPaymentSummary = z.infer<typeof adminPaymentSummarySchema>;
export type AdminPaymentDetail = z.infer<typeof adminPaymentDetailSchema>;
export type AdminPaymentReconcileRequest = z.infer<typeof adminPaymentReconcileRequestSchema>;
export type AdminPaymentReconcileResponse = z.infer<typeof adminPaymentReconcileResponseSchema>;
export type AdminPaymentAttemptRef = z.infer<typeof adminPaymentAttemptRefSchema>;
export type AdminPaymentProviderRef = z.infer<typeof adminPaymentProviderRefSchema>;
export type AdminPaymentReference = z.infer<typeof adminPaymentReferenceSchema>;
export type AdminPaymentEvent = z.infer<typeof adminPaymentEventSchema>;
export type AdminPaymentAuditEntry = z.infer<typeof adminPaymentAuditEntrySchema>;
export type AdminPaymentReconciliationState = z.infer<
  typeof adminPaymentReconciliationStateSchema
>;
export type AdminPaymentOperationalReview = z.infer<
  typeof adminPaymentOperationalReviewSchema
>;
