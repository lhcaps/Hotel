import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CustomerProfileClient } from '../src/app/account/profile/customer-profile-client';
import AdminBookingsPage from '../src/app/admin/(protected)/bookings/page';
import { LocaleProvider } from '../src/components/locale-provider';
import { PaymentProviderSelector } from '../src/components/payment-provider-selector';

const { listAdminBookings, listPaymentProviders } = vi.hoisted(() => ({
  listAdminBookings: vi.fn(),
  listPaymentProviders: vi.fn(),
}));

vi.mock('../src/lib/admin-api', () => ({
  AdminApiError: class AdminApiError extends Error {},
  adminApi: { listAdminBookings },
}));

vi.mock('../src/lib/booking-api', () => ({
  bookingApi: { listPaymentProviders },
}));

const viewports = [390, 1366] as const;

async function expectNoSeriousOrCritical(container: HTMLElement): Promise<void> {
  const result = await axe(container);
  expect(
    result.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
}

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Phase 8I critical-surface accessibility', () => {
  it.each(viewports)('measures CUSTOMER profile at %ipx', async (width) => {
    setViewport(width);
    const { container } = render(
      <LocaleProvider locale="en">
        <CustomerProfileClient
          apiBase="http://api.example.test"
          initialProfile={{
            userId: '10000000-0000-4000-8000-000000000001',
            email: 'synthetic-customer@example.test',
            name: 'Synthetic Customer',
            phone: null,
            addressLine1: null,
            addressLine2: null,
            ward: null,
            district: null,
            province: null,
            postalCode: null,
            countryCode: 'VN',
            updatedAt: '2027-07-10T00:00:00.000Z',
          }}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Customer profile' })).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it.each(viewports)('measures ADMIN booking filters and table at %ipx', async (width) => {
    setViewport(width);
    listAdminBookings.mockResolvedValue({
      items: [
        {
          bookingCode: 'UAT-CONFIRMED-20270711',
          guestName: 'Synthetic Guest',
          status: 'CONFIRMED',
          roomType: { name: 'Deluxe' },
          room: null,
          checkIn: '2027-07-11T02:00:00.000Z',
          checkOut: '2027-07-11T05:00:00.000Z',
          finalAmountVnd: 359000,
          paymentStatus: 'SUCCEEDED',
          reviewPresence: 'NONE',
        },
      ],
      page: 1,
      totalPages: 1,
    });
    const { container } = render(
      <LocaleProvider locale="en">
        <AdminBookingsPage />
      </LocaleProvider>,
    );

    await screen.findByText('UAT-CONFIRMED-20270711');
    await expectNoSeriousOrCritical(container);
  });

  it.each(viewports)(
    'measures payment selection and unavailable-state text at %ipx',
    async (width) => {
      setViewport(width);
      listPaymentProviders.mockResolvedValue([
        { provider: 'VNPAY', displayName: 'VNPAY', enabled: true, maintenanceMessage: null },
        {
          provider: 'MOMO',
          displayName: 'MoMo',
          enabled: false,
          maintenanceMessage: 'Unavailable in UAT',
        },
      ]);
      const { container } = render(
        <LocaleProvider locale="en">
          <PaymentProviderSelector bookingCode="UAT-HOLD-20270710" />
        </LocaleProvider>,
      );

      await screen.findByRole('button', { name: /Pay with VNPAY/i });
      await expectNoSeriousOrCritical(container);
    },
  );
});
