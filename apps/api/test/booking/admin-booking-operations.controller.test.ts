import { describe, expect, it, vi } from 'vitest';

import { AdminBookingOperationsController } from '../../src/booking/admin-booking-operations.controller.js';
import { AdminBookingAccessPassService } from '../../src/booking/services/admin-booking-access-pass.service.js';

describe('AdminBookingOperationsController', () => {
  it('delegates a pass scan through the ADMIN lifecycle authority without exposing the raw pass', async () => {
    const scanner = {
      scan: vi.fn().mockResolvedValue({
        bookingCode: 'RM-ACCESS-PASS-1',
        status: 'CONFIRMED',
        action: 'check-in',
      }),
    } as unknown as AdminBookingAccessPassService;
    const controller = new AdminBookingOperationsController(
      {} as never,
      {} as never,
      {} as never,
      scanner,
    );

    const result = await controller.scanAccessPass(
      { value: 'signed-access-pass-value' },
      { actor: {} as never, id: 'req-1' },
    );

    expect(result).toEqual({
      bookingCode: 'RM-ACCESS-PASS-1',
      status: 'CONFIRMED',
      action: 'check-in',
    });
    expect(scanner.scan).toHaveBeenCalledWith('signed-access-pass-value', expect.any(Date));
    expect(result).not.toHaveProperty('value');
  });
});
