import { z } from 'zod';

const uuidSchema = z.uuid();
const instantSchema = z.string().datetime({ offset: true });
// Generic plan-code contract: uppercase ASCII, digits and underscore,
// bounded length. Known base-plan codes are exposed as a typed
// convenience for places that need a closed set (legacy Phase 7B
// snapshot diffing, exhaustive oracle fixtures); they are NOT the
// authoritative validation surface. ADMIN-registered rate plans are
// accepted at the API boundary as long as they satisfy this regex.
export const planCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Z0-9_]+$/);

export const KNOWN_BASE_PLAN_CODES = [
  'THREE_HOUR_COMBO',
  'FIVE_HOUR_COMBO',
  'LUNCH_COMBO',
  'NIGHT_COMBO',
  'DAY_COMBO',
] as const;
export type KnownBasePlanCode = (typeof KNOWN_BASE_PLAN_CODES)[number];

const basePlanCodeSchema = planCodeSchema;
const amountVndSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const couponCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9-]{4,32}$/);

function validInterval(checkIn: string, checkOut: string): boolean {
  const durationSeconds = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 1_000;
  return Number.isInteger(durationSeconds) && durationSeconds > 0 && durationSeconds <= 31 * 86_400;
}

const stayModeSchema = z.enum(['hourly', 'overnight', 'multi_night']);
export const stayIntentSchema = z.enum(['hourly', 'overnight', 'multi_night']);

const publicIntervalSchema = z
  .object({
    propertyId: uuidSchema.optional(),
    checkIn: instantSchema,
    checkOut: instantSchema,
    mode: stayModeSchema.optional(),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (!validInterval(value.checkIn, value.checkOut)) {
      context.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: 'Stay duration must be greater than zero and no longer than 31 days.',
      });
    }
  });

/**
 * Additive B0 representation for the public multi-night request. The server
 * still owns policy, pricing, room continuity, and amount authority.
 */
export const multiNightIntentSchema = z
  .object({
    propertyId: uuidSchema.optional(),
    checkIn: instantSchema,
    checkOut: instantSchema,
    mode: z.literal('multi_night'),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (!validInterval(value.checkIn, value.checkOut)) {
      context.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: 'Stay duration must be greater than zero and no longer than 31 days.',
      });
    }
  });

export const availabilitySearchRequestSchema = publicIntervalSchema;

export const createQuoteRequestSchema = publicIntervalSchema
  .extend({
    roomTypeId: uuidSchema,
    couponCode: couponCodeSchema.optional(),
    selectedPlanCode: basePlanCodeSchema.optional(),
  })
  .strict();

export const pricingLineItemSchema = z
  .object({
    code: planCodeSchema,
    amountVnd: amountVndSchema,
    units: z.number().int().min(1).max(168),
  })
  .strict();

export const pricingRuleVersionSchema = z.union([
  z.literal('phase-4-pricing-availability-v1'),
  z.literal('phase-7b-data-driven-pricing-v1'),
  z.literal('phase-8b-cheapest-eligible-pricing-v1'),
]);

// ORIG-G-004 explanation contract: why a plan was selected, and the totals
// of the other valid candidates that were considered. Additive/optional so
// historical quote snapshots (issued before this field existed) remain
// readable without a migration.
export const pricingSelectionReasonSchema = z.enum([
  'LOWEST_GROSS',
  'PRIORITY_TIE_BREAK',
  'EXTRA_UNITS_TIE_BREAK',
  'STABLE_PLAN_TIE_BREAK',
]);

export const pricingAlternativeSchema = z
  .object({
    planCode: basePlanCodeSchema,
    totalAmountVnd: amountVndSchema,
  })
  .strict();

export const pricingBreakdownSchema = z
  .object({
    ruleVersion: pricingRuleVersionSchema,
    selectedPlanCode: basePlanCodeSchema,
    basePlanCode: basePlanCodeSchema,
    baseMinutes: z.number().int().min(60).max(1_440),
    extraUnits: z.number().int().min(0).max(24),
    baseAmountVnd: amountVndSchema,
    extraAmountVnd: amountVndSchema,
    totalAmountVnd: amountVndSchema,
    lineItems: z.array(pricingLineItemSchema).min(1).max(2),
    selectionReason: pricingSelectionReasonSchema.optional(),
    alternatives: z.array(pricingAlternativeSchema).max(16).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.totalAmountVnd !== value.baseAmountVnd + value.extraAmountVnd) {
      context.addIssue({
        code: 'custom',
        path: ['totalAmountVnd'],
        message: 'Total must equal base plus extra.',
      });
    }
    const baseLine = value.lineItems.find((line) => line.code === value.basePlanCode);
    const extraLines = value.lineItems.filter((line) => line.code === 'EXTRA_HOUR');
    const lineItemAmount = value.lineItems.reduce((total, line) => total + line.amountVnd, 0);
    if (baseLine?.units !== 1 || baseLine.amountVnd !== value.baseAmountVnd) {
      context.addIssue({
        code: 'custom',
        path: ['lineItems'],
        message: 'Base line item must match the selected base plan.',
      });
    }
    if (lineItemAmount !== value.totalAmountVnd) {
      context.addIssue({
        code: 'custom',
        path: ['lineItems'],
        message: 'Line items must total the quote amount.',
      });
    }
    const extraLine = extraLines[0];
    if (
      (value.extraUnits === 0 && extraLines.length !== 0) ||
      (value.extraUnits > 0 &&
        (extraLines.length !== 1 ||
          extraLine?.units !== value.extraUnits ||
          extraLine.amountVnd !== value.extraAmountVnd))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['lineItems'],
        message: 'Extra line item must match extra units and amount.',
      });
    }
  });

export const availabilityOfferSummarySchema = z
  .object({
    planLabel: z.string().trim().min(1).max(160),
    amountVnd: amountVndSchema,
    nightCount: z.number().int().min(1).max(31).optional(),
    leadingExtraUnits: z.number().int().min(0).max(24).optional(),
    trailingExtraUnits: z.number().int().min(0).max(24).optional(),
    summary: z.string().trim().min(1).max(280).optional(),
  })
  .strict();

export const availabilityStateSchema = z.enum([
  'AVAILABLE',
  'NO_EXACT_AVAILABILITY',
  'PRICING_CONFIGURATION_UNAVAILABLE',
  'CATALOG_UNAVAILABLE',
  'INVALID_INTERVAL',
  'BELOW_MINIMUM_STAY',
  'ABOVE_MAXIMUM_STAY',
  'INVALID_GUEST_COUNT',
  'NO_CONTINUOUS_ROOM',
  'NO_VALID_PRICING',
  'POLICY_NOT_CONFIGURED',
  'SERVICE_UNAVAILABLE',
]);

export const availabilityPolicySchema = z
  .object({
    minimumStayMinutes: z.number().int().min(1).max(44_640),
    maximumStayMinutes: z.number().int().min(1).max(44_640),
    minimumLeadTimeMinutes: z.number().int().min(0).max(44_640),
    maximumAdvanceBookingDays: z.number().int().min(0).max(3_650),
    defaultOvernightDurationMinutes: z.number().int().min(1).max(44_640),
  })
  .strict();

export const availabilityRoomTypeSchema = z
  .object({
    propertyId: uuidSchema.optional(),
    propertyName: z.string().trim().min(1).max(160).optional(),
    roomTypeId: uuidSchema,
    roomTypeCode: z.string().trim().min(1).max(64),
    roomTypeName: z.string().trim().min(1).max(160),
    maxAdults: z.number().int().min(1),
    maxChildren: z.number().int().min(0),
    maxOccupancy: z.number().int().min(1),
    amenities: z.array(z.string().trim().min(1).max(160)).max(12),
    availableRoomCount: z.number().int().min(0),
    offer: availabilityOfferSummarySchema.nullable(),
    offers: z.array(availabilityOfferSummarySchema).max(24).optional(),
  })
  .strict();

export const availabilitySearchResponseSchema = z
  .object({
    state: availabilityStateSchema.optional(),
    policy: availabilityPolicySchema.optional(),
    requestedInterval: z
      .object({ checkIn: instantSchema, checkOut: instantSchema })
      .strict()
      .optional(),
    items: z.array(availabilityRoomTypeSchema),
  })
  .strict();

const nearbyRoomTypeItemSchema = availabilityRoomTypeSchema.extend({
  description: z.string().max(2_000).nullable(),
});

export const nearbyAvailabilityCandidateSchema = z
  .object({
    checkIn: instantSchema,
    checkOut: instantSchema,
    shiftMinutes: z.number().int().min(-120).max(120),
    roomTypes: z.array(nearbyRoomTypeItemSchema).max(40),
  })
  .strict();

export const nearbyAvailabilityRequestSchema = z
  .object({
    checkIn: instantSchema,
    checkOut: instantSchema,
    mode: stayModeSchema.optional(),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
    expandMinutes: z.number().int().min(0).max(120).default(60),
    limit: z.number().int().min(1).max(12).default(6),
  })
  .strict()
  .superRefine((value, context) => {
    if (!validInterval(value.checkIn, value.checkOut)) {
      context.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: 'Stay duration must be greater than zero and no longer than 31 days.',
      });
    }
  });

export const nearbyAvailabilityResponseSchema = z
  .object({
    requestedCheckIn: instantSchema,
    requestedCheckOut: instantSchema,
    durationMinutes: z.number().int().min(1).max(44_640),
    durationSeconds: z.number().int().min(1).max(2_678_400).optional(),
    candidates: z.array(nearbyAvailabilityCandidateSchema).max(12),
  })
  .strict();

export const availabilityOfferRequestSchema = publicIntervalSchema
  .extend({ roomTypeId: uuidSchema })
  .strict();

export const availabilityEligibleOfferSchema = z
  .object({
    planCode: basePlanCodeSchema,
    planLabel: z.string().trim().min(1).max(160),
    includedDurationMinutes: z.number().int().min(60).max(1_440),
    extraUnits: z.number().int().min(0).max(24),
    totalAmountVnd: amountVndSchema,
    nightCount: z.number().int().min(1).max(31).optional(),
    leadingExtraUnits: z.number().int().min(0).max(5).optional(),
    trailingExtraUnits: z.number().int().min(0).max(5).optional(),
    summary: z.string().trim().min(1).max(240).optional(),
    minCheckInMinuteInclusive: z.number().int().min(0).max(1_425).nullable(),
    maxCheckInMinuteExclusive: z.number().int().min(15).max(1_440).nullable(),
  })
  .strict();

export const availabilityOfferResponseSchema = z
  .object({ items: z.array(availabilityEligibleOfferSchema) })
  .strict();

const multiNightCoverageModelSchema = z.enum([
  'FIXED_ELAPSED',
  'LOCAL_CLOCK_WINDOW',
  'REQUEST_BOUNDARY',
]);
const multiNightBillingModelSchema = z.enum(['FIXED_OCCURRENCE', 'STARTED_UNIT']);

export const multiNightPricingLineSchema = z
  .object({
    componentId: uuidSchema,
    componentCode: planCodeSchema,
    componentDigest: z.string().regex(/^[a-f0-9]{64}$/),
    startAt: instantSchema,
    endAt: instantSchema,
    coverageModel: multiNightCoverageModelSchema,
    boundaryPosition: z.enum(['LEADING', 'TRAILING']).nullable(),
    billingModel: multiNightBillingModelSchema,
    occurrenceCount: z.number().int().min(1).max(64),
    billingUnitQuantity: z.number().int().min(1).max(44_640),
    unitAmountVnd: amountVndSchema,
    lineAmountVnd: amountVndSchema,
    restrictions: z.record(z.string(), z.unknown()),
    sourceV1Provenance: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.lineAmountVnd !== value.unitAmountVnd * value.billingUnitQuantity) {
      context.addIssue({
        code: 'custom',
        path: ['lineAmountVnd'],
        message: 'Line amount must equal unit amount times billing quantity.',
      });
    }
    if (new Date(value.endAt).getTime() <= new Date(value.startAt).getTime()) {
      context.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'Pricing line interval must be positive.',
      });
    }
  });

export const multiNightPricingSchema = z
  .object({
    snapshotSchemaVersion: z.literal('operations-v3-b0.2-pricing-candidate-v1'),
    ruleVersion: z.literal('operations-v3-b0.2-pricing-candidate-v1'),
    selectedPlanCode: planCodeSchema,
    basePlanCode: planCodeSchema,
    policyId: uuidSchema,
    policyVersion: z.string().regex(/^\d+$/),
    applicabilityBasis: z.literal('STAY_START'),
    applicabilityInstant: instantSchema,
    observedPolicyInterval: z
      .object({ effectiveFrom: instantSchema, effectiveUntil: instantSchema.nullable() })
      .strict(),
    requestedInterval: z.object({ checkInAt: instantSchema, checkOutAt: instantSchema }).strict(),
    propertyTimezone: z.string().min(1).max(64),
    lines: z.array(multiNightPricingLineSchema).min(1).max(64),
    displayNightCount: z.number().int().min(1).max(31),
    grossAmountVnd: amountVndSchema,
    discountAmountVnd: amountVndSchema,
    finalAmountVnd: amountVndSchema,
    totalAmountVnd: amountVndSchema,
    componentCount: z.number().int().min(1).max(64),
    conditionComplexity: z.number().int().min(0).max(64_000),
    restrictionRank: z.number().int().min(0).max(64_000),
    stableCandidateId: z.string().regex(/^[a-f0-9]{64}$/),
    rationale: z.string().trim().min(1).max(1_000),
    selectionReason: z
      .enum([
        'LOWEST_VALID_CUSTOMER_TOTAL',
        'FEWER_COMPONENTS_TIE_BREAK',
        'LOWER_CONDITION_COMPLEXITY_TIE_BREAK',
        'LOWER_RESTRICTION_RANK_TIE_BREAK',
        'STABLE_CANDIDATE_TIE_BREAK',
      ])
      .optional(),
    alternatives: z
      .array(
        z
          .object({
            stableCandidateId: z.string().regex(/^[a-f0-9]{64}$/),
            finalAmountVnd: amountVndSchema,
            componentCount: z.number().int().min(1).max(64),
            conditionComplexity: z.number().int().min(0).max(64_000),
            restrictionRank: z.number().int().min(0).max(64_000),
            rationale: z.string().trim().min(1).max(1_000),
          })
          .strict(),
      )
      .max(23)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.componentCount !== value.lines.length) {
      context.addIssue({
        code: 'custom',
        path: ['componentCount'],
        message: 'Component count must match pricing lines.',
      });
    }
    const lineTotal = value.lines.reduce((sum, line) => sum + line.lineAmountVnd, 0);
    if (value.grossAmountVnd !== lineTotal || value.finalAmountVnd !== value.grossAmountVnd) {
      context.addIssue({
        code: 'custom',
        path: ['finalAmountVnd'],
        message: 'Pricing totals must match the immutable line total.',
      });
    }
  });

export const couponQuoteSummarySchema = z
  .object({
    code: couponCodeSchema,
    discountType: z.enum(['FIXED', 'PERCENTAGE']),
    grossAmountVnd: amountVndSchema,
    discountAmountVnd: amountVndSchema,
    finalAmountVnd: amountVndSchema,
    revalidationNotice: z.string().min(1).max(280),
  })
  .strict();

export const cancellationPolicySchema = z
  .object({
    code: z.string().min(1).max(80),
    version: z.number().int().positive(),
    timezone: z.string().min(1).max(64),
    refundBasis: z.literal('PAID_AMOUNT'),
    capturedAt: instantSchema,
    checkIn: instantSchema,
    sevenDayDeadline: instantSchema,
    threeDayDeadline: instantSchema,
  })
  .strict();

export const quoteSchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema.optional(),
    roomTypeId: uuidSchema,
    roomTypeName: z.string().trim().min(1).max(160),
    checkIn: instantSchema,
    checkOut: instantSchema,
    adults: z.number().int().min(1),
    children: z.number().int().min(0),
    mode: stayModeSchema.optional(),
    expiresAt: instantSchema,
    pricing: z.union([pricingBreakdownSchema, multiNightPricingSchema]),
    coupon: couponQuoteSummarySchema.optional(),
    cancellationPolicy: cancellationPolicySchema.optional(),
  })
  .strict();

export const ratePlanPriceSchema = z
  .object({
    priceTierId: uuidSchema,
    amountVnd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  })
  .strict();

export const selectionRuleSchema = z
  .object({
    includedDurationMinutes: z.number().int().min(60).max(1_440),
    priority: z.number().int().min(0).max(1_000),
    isBasePlan: z.boolean(),
    minCheckInMinuteInclusive: z.number().int().min(0).max(1_425).nullable(),
    maxCheckInMinuteExclusive: z.number().int().min(15).max(1_440).nullable(),
    minDurationMinutesInclusive: z.number().int().min(60).max(1_440).nullable(),
    maxDurationMinutesInclusive: z.number().int().min(60).max(1_440).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.minCheckInMinuteInclusive === null) !== (value.maxCheckInMinuteExclusive === null)) {
      context.addIssue({
        code: 'custom',
        path: ['minCheckInMinuteInclusive'],
        message: 'Check-in window must be set as a pair or both null.',
      });
    }
    for (const field of [
      'minCheckInMinuteInclusive',
      'maxCheckInMinuteExclusive',
      'minDurationMinutesInclusive',
      'maxDurationMinutesInclusive',
    ] as const) {
      const candidate = value[field];
      if (candidate !== null && candidate % 15 !== 0) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Value must be a 15-minute increment.',
        });
      }
    }
    if (
      value.minCheckInMinuteInclusive !== null &&
      value.maxCheckInMinuteExclusive !== null &&
      value.maxCheckInMinuteExclusive <= value.minCheckInMinuteInclusive
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxCheckInMinuteExclusive'],
        message: 'End minute must be strictly greater than start minute.',
      });
    }
    if (value.isBasePlan) {
      if (
        value.minDurationMinutesInclusive === null ||
        value.maxDurationMinutesInclusive === null
      ) {
        context.addIssue({
          code: 'custom',
          path: ['minDurationMinutesInclusive'],
          message: 'Base plan must declare both minimum and maximum duration.',
        });
      } else if (value.maxDurationMinutesInclusive < value.minDurationMinutesInclusive) {
        context.addIssue({
          code: 'custom',
          path: ['maxDurationMinutesInclusive'],
          message: 'Maximum duration must be greater than or equal to minimum duration.',
        });
      }
    } else {
      if (
        value.minDurationMinutesInclusive !== null ||
        value.maxDurationMinutesInclusive !== null ||
        value.minCheckInMinuteInclusive !== null ||
        value.maxCheckInMinuteExclusive !== null
      ) {
        context.addIssue({
          code: 'custom',
          path: ['isBasePlan'],
          message: 'Non-base plan must not declare a selection window.',
        });
      }
    }
  });

export const ratePlanSchema = z
  .object({
    id: uuidSchema,
    code: planCodeSchema,
    name: z.string().trim().min(1).max(160),
    status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']),
    includedDurationMinutes: z.number().int().min(60).max(1_440),
    priority: z.number().int().min(0).max(1_000),
    isBasePlan: z.boolean(),
    minCheckInMinuteInclusive: z.number().int().min(0).max(1_425).nullable(),
    maxCheckInMinuteExclusive: z.number().int().min(15).max(1_440).nullable(),
    minDurationMinutesInclusive: z.number().int().min(60).max(1_440).nullable(),
    maxDurationMinutesInclusive: z.number().int().min(60).max(1_440).nullable(),
    prices: z.array(ratePlanPriceSchema),
  })
  .strict();

export const ratePlanPriceCommandSchema = z
  .object({ amountVnd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) })
  .strict();

export const ratePlanSelectionRuleCommandSchema = z
  .object({
    includedDurationMinutes: z.number().int().min(60).max(1_440).optional(),
    priority: z.number().int().min(0).max(1_000).optional(),
    minCheckInMinuteInclusive: z.number().int().min(0).max(1_425).nullable().optional(),
    maxCheckInMinuteExclusive: z.number().int().min(15).max(1_440).nullable().optional(),
    minDurationMinutesInclusive: z.number().int().min(60).max(1_440).nullable().optional(),
    maxDurationMinutesInclusive: z.number().int().min(60).max(1_440).nullable().optional(),
  })
  .strict();

export const ratePlanActivationSchema = z
  .object({ activate: z.literal(true).default(true) })
  .strict();

export const ratePlanCreateCommandSchema = z
  .object({
    code: planCodeSchema,
    name: z.string().trim().min(1).max(160),
    includedDurationMinutes: z.number().int().min(60).max(1_440),
    priority: z.number().int().min(0).max(1_000),
    isBasePlan: z.boolean().default(true),
    minCheckInMinuteInclusive: z.number().int().min(0).max(1_425).nullable().default(null),
    maxCheckInMinuteExclusive: z.number().int().min(15).max(1_440).nullable().default(null),
    minDurationMinutesInclusive: z.number().int().min(60).max(1_440).nullable().default(null),
    maxDurationMinutesInclusive: z.number().int().min(60).max(1_440).nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.minCheckInMinuteInclusive === null) !== (value.maxCheckInMinuteExclusive === null)) {
      context.addIssue({
        code: 'custom',
        path: ['minCheckInMinuteInclusive'],
        message: 'Check-in window must be set as a pair or both null.',
      });
    }
    for (const field of [
      'minCheckInMinuteInclusive',
      'maxCheckInMinuteExclusive',
      'minDurationMinutesInclusive',
      'maxDurationMinutesInclusive',
    ] as const) {
      const candidate = value[field];
      if (candidate !== null && candidate % 15 !== 0) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Value must be a 15-minute increment.',
        });
      }
    }
    if (
      value.minCheckInMinuteInclusive !== null &&
      value.maxCheckInMinuteExclusive !== null &&
      value.maxCheckInMinuteExclusive <= value.minCheckInMinuteInclusive
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxCheckInMinuteExclusive'],
        message: 'End minute must be strictly greater than start minute.',
      });
    }
    if (value.isBasePlan) {
      if (
        value.minDurationMinutesInclusive === null ||
        value.maxDurationMinutesInclusive === null
      ) {
        context.addIssue({
          code: 'custom',
          path: ['minDurationMinutesInclusive'],
          message: 'Base plan must declare both minimum and maximum duration.',
        });
      } else if (value.maxDurationMinutesInclusive < value.minDurationMinutesInclusive) {
        context.addIssue({
          code: 'custom',
          path: ['maxDurationMinutesInclusive'],
          message: 'Maximum duration must be greater than or equal to minimum duration.',
        });
      }
    } else {
      if (
        value.minDurationMinutesInclusive !== null ||
        value.maxDurationMinutesInclusive !== null ||
        value.minCheckInMinuteInclusive !== null ||
        value.maxCheckInMinuteExclusive !== null
      ) {
        context.addIssue({
          code: 'custom',
          path: ['isBasePlan'],
          message: 'Non-base plan must not declare a selection window.',
        });
      }
    }
  });

export type AvailabilitySearchRequest = z.infer<typeof availabilitySearchRequestSchema>;
export type AvailabilitySearchResponse = z.infer<typeof availabilitySearchResponseSchema>;
export type AvailabilityState = z.infer<typeof availabilityStateSchema>;
export type AvailabilityPolicy = z.infer<typeof availabilityPolicySchema>;
export type NearbyAvailabilityRequest = z.infer<typeof nearbyAvailabilityRequestSchema>;
export type NearbyAvailabilityResponse = z.infer<typeof nearbyAvailabilityResponseSchema>;
export type NearbyAvailabilityCandidate = z.infer<typeof nearbyAvailabilityCandidateSchema>;
export type AvailabilityOfferRequest = z.infer<typeof availabilityOfferRequestSchema>;
export type AvailabilityOfferResponse = z.infer<typeof availabilityOfferResponseSchema>;
export type CreateQuoteRequest = z.infer<typeof createQuoteRequestSchema>;
export type StayIntent = z.infer<typeof stayIntentSchema>;
export type MultiNightIntent = z.infer<typeof multiNightIntentSchema>;
export type PricingRuleVersion = z.infer<typeof pricingRuleVersionSchema>;
export type PricingBreakdown = z.infer<typeof pricingBreakdownSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type CouponQuoteSummary = z.infer<typeof couponQuoteSummarySchema>;
export type RatePlan = z.infer<typeof ratePlanSchema>;
export type RatePlanSelectionRule = z.infer<typeof selectionRuleSchema>;
export type RatePlanPriceCommand = z.infer<typeof ratePlanPriceCommandSchema>;
export type RatePlanSelectionRuleCommand = z.infer<typeof ratePlanSelectionRuleCommandSchema>;
export type RatePlanCreateCommand = z.infer<typeof ratePlanCreateCommandSchema>;

export const recommendationRequestSchema = publicIntervalSchema
  .extend({ roomTypeId: uuidSchema, couponCode: couponCodeSchema.optional() })
  .strict();

export const recommendationCandidateSchema = z
  .object({
    checkIn: instantSchema,
    checkOut: instantSchema,
    shiftMinutes: z.number().int().min(-60).max(60),
    selectedPlanCode: planCodeSchema,
    grossAmountVnd: amountVndSchema,
    discountAmountVnd: amountVndSchema,
    finalAmountVnd: amountVndSchema,
    savingsVnd: z.number().int().min(0),
    availabilityStatus: z.enum(['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN']),
    category: z.enum(['CLOSEST_CHEAPER', 'CHEAPEST_NEARBY', 'PARETO_ALTERNATIVE']),
  })
  .strict();

export const recommendationExactResultSchema = z
  .object({
    pricing: pricingBreakdownSchema,
    finalAmountVnd: amountVndSchema,
    discountAmountVnd: amountVndSchema,
  })
  .strict();

export const recommendationResponseSchema = z
  .object({
    exactResult: recommendationExactResultSchema,
    recommendations: z.array(recommendationCandidateSchema).max(3),
    generatedAt: instantSchema,
    advisoryExpiresAt: instantSchema,
  })
  .strict();

export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;
export type RecommendationCandidate = z.infer<typeof recommendationCandidateSchema>;
export type RecommendationExactResult = z.infer<typeof recommendationExactResultSchema>;
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;
