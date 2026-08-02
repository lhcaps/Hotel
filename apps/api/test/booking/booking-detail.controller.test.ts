import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import { BookingDetailController } from '../../src/booking/booking-detail.controller.js';
import { BookingAccessPassService } from '../../src/booking/services/booking-access-pass.service.js';

describe('BookingDetailController', () => {
  it('delegates a guest-authorized access-pass request with the decoded session token', async () => {
    const token = Buffer.from('guest-session-token-for-access-pass', 'utf8');
    const response = {
      bookingCode: 'RM-AB12-CD34-EF56',
      expiresAt: '2026-07-23T08:00:00.000Z',
      svg: '<svg />',
    };
    const details = {
      getAccessPass: vi.fn().mockResolvedValue(response),
    };
    const passes = new BookingAccessPassService(
      Buffer.from('booking-detail-controller-access-pass-test-secret-32-plus', 'utf8'),
    );
    const Controller = BookingDetailController as unknown as new (
      details: unknown,
      sessions: unknown,
      accessPasses: BookingAccessPassService,
    ) => unknown;
    const controller = new Controller(details, {}, passes) as {
      accessPass(
        bookingCode: string,
        request: { cookies: Record<string, string> },
      ): Promise<typeof response>;
    };

    await expect(
      controller.accessPass(response.bookingCode, {
        cookies: { rm_guest_session_v1: token.toString('base64url') },
      }),
    ).resolves.toEqual(response);
    expect(details.getAccessPass).toHaveBeenCalledWith(
      response.bookingCode,
      token,
      expect.any(Date),
      passes,
    );
  });
});
