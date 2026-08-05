import { z } from 'zod';

const instantSchema = z.string().datetime({ offset: true });

export const adminRoomOperationsQuerySchema = z
  .object({
    from: instantSchema,
    to: instantSchema,
    includeInactive: z
      .preprocess((value) => value === true || value === 'true', z.boolean())
      .default(false),
  })
  .strict()
  .superRefine((value, context) => {
    const duration = new Date(value.to).getTime() - new Date(value.from).getTime();
    if (duration < 0 || duration > 7 * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Select a range up to seven days.',
      });
    }
  });

export const adminRoomOperationBookingSchema = z
  .object({
    bookingCode: z.string().min(1).max(64),
    status: z.enum([
      'HOLD',
      'CONFIRMED',
      'EXPIRED',
      'CANCELLED',
      'NO_SHOW',
      'CHECKED_IN',
      'CHECKED_OUT',
    ]),
    checkIn: instantSchema,
    checkOut: instantSchema,
  })
  .strict();

export const adminRoomOperationWindowSchema = z
  .object({ startsAt: instantSchema, endsAt: instantSchema })
  .strict();

export const adminRoomOperationHousekeepingTaskSchema = z
  .object({
    type: z.enum(['ARRIVAL_PREP', 'TURNOVER']),
    status: z.enum(['SCHEDULED', 'DUE', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
    dueAt: instantSchema,
  })
  .strict();

export const adminRoomOperationBookingWindowSchema = z
  .object({ checkIn: instantSchema, checkOut: instantSchema })
  .strict();

export const adminRoomOperationRowSchema = z
  .object({
    roomId: z.uuid(),
    roomNumber: z.string().min(1).max(64),
    physicalRoomCode: z.string().min(1).max(128),
    roomTier: z.string().min(1).max(160),
    floor: z.string().min(1).max(32).nullable(),
    roomConcept: z.string().min(1).max(200),
    roomStatus: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']),
    housekeepingStatus: z.enum(['CLEAN', 'DIRTY', 'CLEANING']),
    maintenanceState: z.enum(['ACTIVE', 'NONE']),
    currentOccupancy: z.enum(['OCCUPIED', 'VACANT']),
    nextBookingWindow: adminRoomOperationBookingWindowSchema.nullable(),
    bookings: z.array(adminRoomOperationBookingSchema).readonly(),
    freeWindows: z.array(adminRoomOperationWindowSchema).readonly(),
    activeHousekeepingTask: adminRoomOperationHousekeepingTaskSchema.nullable(),
  })
  .strict();

export const adminRoomOperationsResponseSchema = z
  .object({ items: z.array(adminRoomOperationRowSchema).readonly(), generatedAt: instantSchema })
  .strict();

export type AdminRoomOperationsQuery = z.infer<typeof adminRoomOperationsQuerySchema>;
export type AdminRoomOperationsResponse = z.infer<typeof adminRoomOperationsResponseSchema>;
