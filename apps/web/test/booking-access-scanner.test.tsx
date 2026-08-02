import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BookingAccessScanner } from '../src/components/booking-access-scanner';
import { LocaleProvider } from '../src/components/locale-provider';

const { scanBookingAccessPass } = vi.hoisted(() => ({ scanBookingAccessPass: vi.fn() }));

vi.mock('../src/lib/admin-api', () => ({
  AdminApiError: class AdminApiError extends Error {},
  adminApi: { scanBookingAccessPass },
}));

describe('BookingAccessScanner', () => {
  beforeEach(() => scanBookingAccessPass.mockReset());

  it('uses manual entry as a protected fallback and directs the ADMIN to an explicit lifecycle action', async () => {
    scanBookingAccessPass.mockResolvedValue({
      bookingCode: 'RM-ACCESS-PASS-1',
      status: 'CONFIRMED',
      action: 'check-in',
    });
    const user = userEvent.setup();
    render(
      <LocaleProvider locale="en">
        <BookingAccessScanner />
      </LocaleProvider>,
    );

    await user.type(screen.getByLabelText('Access pass'), 'signed-pass-value');
    await user.click(screen.getByRole('button', { name: 'Verify pass' }));

    expect(await screen.findByText('Ready for check-in')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open booking' })).toHaveAttribute(
      'href',
      '/admin/bookings/RM-ACCESS-PASS-1',
    );
    expect(scanBookingAccessPass).toHaveBeenCalledWith('signed-pass-value');
  });
});
