import { z } from 'zod';

const instantSchema = z.string().datetime({ offset: true });

export const adminRoomOperationsQuerySchema = z
  .object({ from: instantSchema, to: instantSchema })
  .strict()
  .superRefine((value, context) => {
    const duration = new Date(value.to).getTime() - new Date(value.from).getTime();
    if (duration < 0 || duration > 7 * 24 * 60 * 60 * 1000) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'Select a range up to seven days.' });
    }
  });

export const adminRoomOperationBookingSchema = z
  .object({
    bookingCode: z.string().min(1).max(64),
    status: z.enum(['HOLD', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'NO_SHOW', 'CHECKED_IN', 'CHECKED_OUT']),
    checkIn: instantSchema,
    checkOut: instantSchema,
  })
  .strict();

export const adminRoomOperationRowSchema = z
  .object({
    roomId: z.uuid(),
    roomNumber: z.string().min(1).max(64),
    roomStatus: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']),
    housekeepingStatus: z.enum(['CLEAN', 'DIRTY', 'CLEANING']),
    maintenanceState: z.enum(['ACTIVE', 'NONE']),
    bookings: z.array(adminRoomOperationBookingSchema).readonly(),
  })
  .strict();

export const adminRoomOperationsResponseSchema = z
  .object({ items: z.array(adminRoomOperationRowSchema).readonly(), generatedAt: instantSchema })
  .strict();

export type AdminRoomOperationsQuery = z.infer<typeof adminRoomOperationsQuerySchema>;
export type AdminRoomOperationsResponse = z.infer<typeof adminRoomOperationsResponseSchema>;
