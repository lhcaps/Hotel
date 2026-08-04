import { z } from 'zod';

const uuidSchema = z.uuid();
const catalogCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((value) => value.toUpperCase());
const nameSchema = z.string().trim().min(1).max(160);
const optionalDescriptionSchema = z.string().trim().min(1).max(2_000).nullable().optional();
const statusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const adminRoleSchema = z.enum(['ADMIN', 'SUPER_ADMIN', 'ROOM_STATUS_VIEWER']);
export const roomHousekeepingStatusSchema = z.enum(['CLEAN', 'DIRTY', 'CLEANING']);
const instantSchema = z.string().datetime({ offset: true });

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const fieldErrorSchema = z
  .object({
    field: z.string().min(1).max(160),
    message: z.string().min(1).max(500),
  })
  .strict();

export const problemDetailsSchema = z
  .object({
    type: z.string().min(1).max(160),
    title: z.string().min(1).max(160),
    status: z.number().int().min(400).max(599),
    code: z.string().min(1).max(100),
    detail: z.string().min(1).max(1_000),
    requestId: z.string().min(1).max(160),
    errors: z.array(fieldErrorSchema).max(100),
  })
  .strict();

export const adminMeSchema = z
  .object({
    id: uuidSchema,
    email: z.email(),
    displayName: nameSchema,
    role: adminRoleSchema,
    permissions: z.array(z.string().min(1)).readonly(),
    sessionExpiresAt: instantSchema,
    departments: z.array(z.string().min(1).max(160)).readonly().optional(),
  })
  .strict();

export const adminDepartmentSchema = z
  .object({
    id: uuidSchema,
    code: catalogCodeSchema,
    name: nameSchema,
    status: statusSchema,
    memberCount: z.number().int().min(0),
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export const adminDepartmentCommandSchema = z
  .object({ code: catalogCodeSchema, name: nameSchema })
  .strict();

export const adminAccountSchema = z
  .object({
    id: uuidSchema,
    displayName: nameSchema,
    emailMasked: z.string().trim().min(3).max(320),
    status: z.enum(['ACTIVE', 'DISABLED']),
    role: adminRoleSchema,
    departments: z.array(z.string().min(1).max(160)).readonly(),
    activeSessionCount: z.number().int().min(0),
    lastActivityAt: instantSchema.nullable(),
    createdAt: instantSchema,
  })
  .strict();

export const adminAccountPatchSchema = z
  .object({
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
    role: adminRoleSchema.optional(),
    departmentIds: z.array(uuidSchema).max(20).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one account change is required.');

export const adminAccountCreateSchema = z
  .object({
    displayName: nameSchema,
    email: z.email(),
    password: z.string().min(8).max(128),
    role: adminRoleSchema,
    departmentIds: z.array(uuidSchema).max(20).default([]),
  })
  .strict();

export const adminCustomerAccountSchema = z
  .object({
    id: uuidSchema,
    displayName: nameSchema,
    emailMasked: z.string().trim().min(3).max(320),
    providers: z.array(z.string().trim().min(1).max(160)).readonly(),
    status: z.enum(['ACTIVE', 'DISABLED']),
    bookingCount: z.number().int().min(0),
    activeSessionCount: z.number().int().min(0),
    lastActivityAt: instantSchema.nullable(),
    createdAt: instantSchema,
  })
  .strict();

export const adminCustomerAccountPatchSchema = z
  .object({ status: z.enum(['ACTIVE', 'DISABLED']) })
  .strict();

export const adminAuditEntrySchema = z
  .object({
    id: uuidSchema,
    eventType: z.string().trim().min(1).max(160),
    actorId: uuidSchema.nullable(),
    aggregateType: z.string().trim().min(1).max(160),
    aggregateId: uuidSchema,
    payload: z.record(z.string(), z.unknown()),
    occurredAt: instantSchema,
  })
  .strict();

export const adminAuditResponseSchema = z
  .object({ items: z.array(adminAuditEntrySchema).max(100) })
  .strict();

export const propertySchema = z
  .object({
    id: uuidSchema,
    code: catalogCodeSchema,
    name: nameSchema,
    timezone: z.string().trim().min(1).max(80),
    currency: z.literal('VND'),
    status: statusSchema,
    minimumStayMinutes: z.number().int().min(1).max(44_640).optional(),
    maximumStayMinutes: z.number().int().min(1).max(44_640).optional(),
    minimumLeadTimeMinutes: z.number().int().min(0).max(44_640).optional(),
    maximumAdvanceBookingDays: z.number().int().min(0).max(3_650).optional(),
    defaultOvernightDurationMinutes: z.number().int().min(1).max(44_640).optional(),
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export const propertyCommandSchema = z
  .object({
    code: catalogCodeSchema,
    name: nameSchema,
    minimumStayMinutes: z.number().int().min(1).max(44_640).optional(),
    maximumStayMinutes: z.number().int().min(1).max(44_640).optional(),
    minimumLeadTimeMinutes: z.number().int().min(0).max(44_640).optional(),
    maximumAdvanceBookingDays: z.number().int().min(0).max(3_650).optional(),
    defaultOvernightDurationMinutes: z.number().int().min(1).max(44_640).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minimumStayMinutes !== undefined &&
      value.maximumStayMinutes !== undefined &&
      value.maximumStayMinutes < value.minimumStayMinutes
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maximumStayMinutes'],
        message: 'Maximum stay must be at least the minimum stay.',
      });
    }
    if (
      value.defaultOvernightDurationMinutes !== undefined &&
      value.maximumStayMinutes !== undefined &&
      value.defaultOvernightDurationMinutes > value.maximumStayMinutes
    ) {
      context.addIssue({
        code: 'custom',
        path: ['defaultOvernightDurationMinutes'],
        message: 'Default overnight duration must fit within the maximum stay.',
      });
    }
  });

export const priceTierSchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema,
    code: catalogCodeSchema,
    name: nameSchema,
    sortOrder: z.number().int().min(0),
    status: statusSchema,
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export const priceTierCommandSchema = z
  .object({
    code: catalogCodeSchema,
    name: nameSchema,
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();

export const roomTypeSchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema,
    priceTierId: uuidSchema,
    code: catalogCodeSchema,
    name: nameSchema,
    description: z.string().nullable(),
    maxAdults: z.number().int().min(1).max(20),
    maxChildren: z.number().int().min(0).max(20),
    maxOccupancy: z.number().int().min(1).max(40),
    status: statusSchema,
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export const roomTypeCommandSchema = z
  .object({
    priceTierId: uuidSchema,
    code: catalogCodeSchema,
    name: nameSchema,
    description: optionalDescriptionSchema,
    maxAdults: z.number().int().min(1).max(20),
    maxChildren: z.number().int().min(0).max(20).default(0),
    maxOccupancy: z.number().int().min(1).max(40),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.maxOccupancy < value.maxAdults || value.maxOccupancy < value.maxChildren) {
      context.addIssue({ code: 'custom', path: ['maxOccupancy'], message: 'Capacity is invalid.' });
    }
    if (value.maxOccupancy > value.maxAdults + value.maxChildren) {
      context.addIssue({ code: 'custom', path: ['maxOccupancy'], message: 'Capacity is invalid.' });
    }
  });

/**
 * Mutable subset of a room type. `code` is intentionally immutable: codes
 * are the stable identifier surfaced in quotes and reports. Setting
 * `description: null` clears the optional description; omitting the field
 * leaves the existing value untouched on the wire contract.
 */
export const roomTypePatchSchema = z
  .object({
    name: nameSchema.optional(),
    description: z.union([z.string().trim().min(1).max(2_000), z.null()]).optional(),
    maxAdults: z.number().int().min(1).max(20).optional(),
    maxChildren: z.number().int().min(0).max(20).optional(),
    maxOccupancy: z.number().int().min(1).max(40).optional(),
    priceTierId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.maxAdults !== undefined &&
      value.maxChildren !== undefined &&
      value.maxOccupancy !== undefined &&
      (value.maxOccupancy < value.maxAdults ||
        value.maxOccupancy < value.maxChildren ||
        value.maxOccupancy > value.maxAdults + value.maxChildren)
    ) {
      context.addIssue({ code: 'custom', path: ['maxOccupancy'], message: 'Capacity is invalid.' });
    }
    if (
      value.maxAdults !== undefined &&
      value.maxChildren === undefined &&
      value.maxOccupancy !== undefined &&
      (value.maxOccupancy < value.maxAdults || value.maxOccupancy > value.maxAdults + 20)
    ) {
      context.addIssue({ code: 'custom', path: ['maxOccupancy'], message: 'Capacity is invalid.' });
    }
    if (
      value.maxAdults === undefined &&
      value.maxChildren !== undefined &&
      value.maxOccupancy !== undefined &&
      value.maxOccupancy < value.maxChildren
    ) {
      context.addIssue({ code: 'custom', path: ['maxOccupancy'], message: 'Capacity is invalid.' });
    }
  });

export type RoomTypePatch = z.infer<typeof roomTypePatchSchema>;

export const amenitySchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema,
    code: catalogCodeSchema,
    name: nameSchema,
    status: statusSchema,
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export const amenityCommandSchema = z
  .object({ code: catalogCodeSchema, name: nameSchema })
  .strict();

/**
 * Mutable subset of an amenity. `code` is intentionally immutable because
 * the code is the stable identifier referenced by integrations and reports.
 */
export const amenityPatchSchema = z
  .object({ name: nameSchema })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: 'custom', message: 'Patch is empty.' });
    }
  });

export type AmenityPatch = z.infer<typeof amenityPatchSchema>;

export const roomSchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema,
    roomTypeId: uuidSchema,
    roomNumber: z.string().trim().min(1).max(64),
    physicalRoomCode: z.string().trim().min(1).max(128),
    status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']),
    housekeepingStatus: roomHousekeepingStatusSchema,
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export const roomCommandSchema = z
  .object({
    roomTypeId: uuidSchema,
    roomNumber: z.string().trim().min(1).max(64),
    physicalRoomCode: z.string().trim().min(1).max(128).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
  })
  .strict();

/**
 * Mutable subset of a physical room. The `roomTypeId` mutation enforces
 * the same property invariant at the server (target room type belongs to
 * the same property) and rejects retyping when the room is currently
 * held by a booking, in maintenance, or has a future active booking block.
 */
export const roomPatchSchema = z
  .object({
    roomNumber: z.string().trim().min(1).max(64).optional(),
    roomTypeId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: 'custom', message: 'Patch is empty.' });
    }
  });

export type RoomPatch = z.infer<typeof roomPatchSchema>;

export const roomHousekeepingCommandSchema = z
  .object({ status: roomHousekeepingStatusSchema })
  .strict();

export const maintenanceBlockSchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema,
    roomId: uuidSchema,
    startsAt: instantSchema,
    endsAt: instantSchema,
    reason: z.string().trim().min(1).max(1_000),
    status: z.enum(['ACTIVE', 'CANCELLED']),
    cancelledAt: instantSchema.nullable(),
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export const maintenanceBlockCommandSchema = z
  .object({
    roomId: uuidSchema,
    startsAt: instantSchema,
    endsAt: instantSchema,
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
      context.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start.' });
    }
  });

export const archiveCommandSchema = z.object({ archive: z.literal(true).default(true) }).strict();

export const assignAmenityCommandSchema = z.object({ amenityId: uuidSchema }).strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type AdminMe = z.infer<typeof adminMeSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminDepartment = z.infer<typeof adminDepartmentSchema>;
export type AdminDepartmentCommand = z.infer<typeof adminDepartmentCommandSchema>;
export type AdminAccount = z.infer<typeof adminAccountSchema>;
export type AdminAccountPatch = z.infer<typeof adminAccountPatchSchema>;
export type AdminAccountCreate = z.infer<typeof adminAccountCreateSchema>;
export type AdminCustomerAccount = z.infer<typeof adminCustomerAccountSchema>;
export type AdminCustomerAccountPatch = z.infer<typeof adminCustomerAccountPatchSchema>;
export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;
export type Property = z.infer<typeof propertySchema>;
export type PropertyCommand = z.infer<typeof propertyCommandSchema>;
export type PriceTier = z.infer<typeof priceTierSchema>;
export type PriceTierCommand = z.infer<typeof priceTierCommandSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export type RoomTypeCommand = z.infer<typeof roomTypeCommandSchema>;
export type Amenity = z.infer<typeof amenitySchema>;
export type AmenityCommand = z.infer<typeof amenityCommandSchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomCommand = z.infer<typeof roomCommandSchema>;
export type RoomHousekeepingCommand = z.infer<typeof roomHousekeepingCommandSchema>;
export type MaintenanceBlock = z.infer<typeof maintenanceBlockSchema>;
export type MaintenanceBlockCommand = z.infer<typeof maintenanceBlockCommandSchema>;
