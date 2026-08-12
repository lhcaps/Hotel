import {
  adminBookingAccessPassScanResponseSchema,
  type AdminBookingAccessPassScanResponse,
} from '@room/contracts';

import { BookingDetailRepository } from '../repositories/booking-detail.repository.js';
import { BookingAccessPassError, BookingAccessPassService } from './booking-access-pass.service.js';

export class AdminBookingAccessPassService {
  public constructor(
    private readonly passes: BookingAccessPassService,
    private readonly bookings: BookingDetailRepository,
  ) {}

  public async scan(
    value: string,
    now: Date,
    propertyId?: string,
  ): Promise<AdminBookingAccessPassScanResponse> {
    if (propertyId === undefined) throw new BookingAccessPassError();
    const payload = this.passes.verify(value, now);
    const booking = await this.bookings.findAccessPassRecord(propertyId, payload.bookingId);
    if (
      booking === null ||
      booking.accessPassRevokedAt !== null ||
      booking.accessPassVersion !== payload.version
    ) {
      throw new BookingAccessPassError();
    }
    if (booking.status === 'CONFIRMED') {
      return adminBookingAccessPassScanResponseSchema.parse({
        bookingCode: booking.bookingCode,
        status: booking.status,
        action: 'check-in',
      });
    }
    if (booking.status === 'CHECKED_IN') {
      return adminBookingAccessPassScanResponseSchema.parse({
        bookingCode: booking.bookingCode,
        status: booking.status,
        action: 'check-out',
      });
    }
    throw new BookingAccessPassError();
  }
}
