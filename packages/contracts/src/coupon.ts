import { z } from 'zod';

const uuidSchema = z.uuid();
const instantSchema = z.string().datetime({ offset: true });
const adminCouponCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9-]{4,32}$/)
  .transform((value) => value.toUpperCase());

const couponDiscountTypeSchema = z.enum(['FIXED', 'PERCENTAGE']);
const couponStatusSchema = z.enum(['ACTIVE', 'DISABLED']);
const couponLifecycleSchema = z.enum(['AVAILABLE', 'EXPIRED', 'DISABLED']);

export const adminBookingCouponDeliverySchema = z
  .object({
    couponCodes: z.array(adminCouponCodeSchema).min(1).max(10),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.couponCodes).size !== value.couponCodes.length) {
      context.addIssue({
        code: 'custom',
        path: ['couponCodes'],
        message: 'Coupon codes must be unique.',
      });
    }
  });

export const couponDeliveryQueueResultSchema = z
  .object({
    deliveryId: uuidSchema,
    status: z.enum(['PENDING', 'SENT']),
  })
  .strict();

const amountVndSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const couponRoomTypeSelectionSchema = z.union([
  z.object({ all: z.literal(true) }).strict(),
  z.object({ roomTypeIds: z.array(uuidSchema).min(1).max(50) }).strict(),
]);

const couponCreatePayloadFixedSchema = z
  .object({
    code: adminCouponCodeSchema,
    discountType: z.literal('FIXED'),
    fixedAmountVnd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    minimumOrderAmountVnd: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
    validFrom: instantSchema,
    validUntil: instantSchema,
    roomTypes: couponRoomTypeSelectionSchema,
    totalUsageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    perCustomerLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Date(value.validUntil).getTime() <= new Date(value.validFrom).getTime()) {
      context.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'Coupon end must be after start.',
      });
    }
  });

const couponCreatePayloadPercentageSchema = z
  .object({
    code: adminCouponCodeSchema,
    discountType: z.literal('PERCENTAGE'),
    percentageBasisPoints: z.number().int().min(1).max(10_000),
    maximumDiscountVnd: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .optional(),
    minimumOrderAmountVnd: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
    validFrom: instantSchema,
    validUntil: instantSchema,
    roomTypes: couponRoomTypeSelectionSchema,
    totalUsageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    perCustomerLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Date(value.validUntil).getTime() <= new Date(value.validFrom).getTime()) {
      context.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'Coupon end must be after start.',
      });
    }
  });

export const adminCouponCreateFixedSchema = couponCreatePayloadFixedSchema;
export const adminCouponCreatePercentageSchema = couponCreatePayloadPercentageSchema;
const couponCreatePayloadSchema = z.discriminatedUnion('discountType', [
  couponCreatePayloadFixedSchema,
  couponCreatePayloadPercentageSchema,
]);

export const adminCouponCreateSchema = couponCreatePayloadSchema;
export const couponSchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema,
    code: adminCouponCodeSchema,
    status: couponStatusSchema,
    lifecycle: couponLifecycleSchema,
    discountType: couponDiscountTypeSchema,
    fixedAmountVnd: amountVndSchema.nullable(),
    percentageBasisPoints: z.number().int().min(1).max(10_000).nullable(),
    maximumDiscountVnd: amountVndSchema.nullable(),
    minimumOrderAmountVnd: z.number().int().min(0),
    validFrom: instantSchema,
    validUntil: instantSchema,
    appliesToAllRoomTypes: z.boolean(),
    roomTypeIds: z.array(uuidSchema),
    totalUsageLimit: z.number().int().min(1).nullable(),
    perCustomerLimit: z.number().int().min(1).nullable(),
    counts: z
      .object({
        activeReservations: z.number().int().min(0),
        redeemed: z.number().int().min(0),
        released: z.number().int().min(0),
      })
      .strict(),
    createdAt: instantSchema,
    updatedAt: instantSchema,
    disabledAt: instantSchema.nullable(),
  })
  .strict();

export const couponListSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    items: z.array(couponSchema),
  })
  .strict();

export type AdminCouponCreate = z.infer<typeof adminCouponCreateSchema>;
export type Coupon = z.infer<typeof couponSchema>;
export type CouponList = z.infer<typeof couponListSchema>;
export type CouponLifecycle = z.infer<typeof couponLifecycleSchema>;
export type CouponDiscountType = z.infer<typeof couponDiscountTypeSchema>;
export type AdminBookingCouponDelivery = z.infer<typeof adminBookingCouponDeliverySchema>;
export type CouponDeliveryQueueResult = z.infer<typeof couponDeliveryQueueResultSchema>;
