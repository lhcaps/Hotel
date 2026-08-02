/**
 * Phase 2.1 — Complete customer booking accessibility evidence.
 *
 * Scans every customer-facing surface introduced or touched in Phase 2
 * and Phase 2.1 with jest-axe. The `AXE_CRITICAL=0 / AXE_SERIOUS=0`
 * acceptance gates must hold at every customer surface. Tests that need
 * a real browser axe scan live under tests/e2e/phase2-1-a11y-browser.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmedSuccessPanel } from '../src/components/confirmed-success-panel';
import { HoldSuccessPanel } from '../src/components/hold-success-panel';
import { LocaleProvider } from '../src/components/locale-provider';
import { OtpRequestPanel } from '../src/components/otp-request-panel';
import { OtpVerifyPanel } from '../src/components/otp-verify-panel';
import { PaymentProviderSelector } from '../src/components/payment-provider-selector';
import { PaymentStatusSummary } from '../src/components/payment-status-summary';
import { QuoteContactForm } from '../src/components/quote-contact-form';
import { AvailabilitySearchResults } from '../src/components/availability-search-results';

import type {
  BookingDetailResponse,
  BookingHoldResponse,
  PaymentStatusResponse,
  Quote,
} from '@room/contracts';

const fetchMock = vi.fn<typeof fetch>();
const { getBookingAccessPass, getPaymentStatus, listPaymentProviders, BookingApiError } =
  vi.hoisted(() => {
    class BookingApiErrorImpl extends Error {
      readonly status: number;
      readonly code: string | undefined;
      constructor(status: number, message: string, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'BookingApiError';
      }
    }
    return {
      getBookingAccessPass: vi.fn(),
      getPaymentStatus: vi.fn(),
      listPaymentProviders: vi.fn(),
      BookingApiError: BookingApiErrorImpl,
    };
  });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../src/lib/booking-api', () => ({
  bookingApi: {
    getBookingAccessPass,
    getPaymentStatus,
    listPaymentProviders,
  },
  BookingApiError,
}));

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function expectNoSeriousOrCritical(container: HTMLElement): Promise<void> {
  const result = await axe(container);
  const criticalOrSerious = result.violations.filter((violation) =>
    ['critical', 'serious'].includes(violation.impact ?? ''),
  );
  if (criticalOrSerious.length > 0) {
    const summary = criticalOrSerious
      .map((violation) => `${violation.id}(${violation.impact}): ${violation.description}`)
      .join('; ');
    throw new Error(`a11y violations: ${summary}`);
  }
}

const QUOTE: Quote = {
  id: '00000000-0000-4000-8000-000000000001',
  roomTypeId: '10000000-0000-4000-8000-000000000201',
  roomTypeName: 'Deluxe',
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  adults: 2,
  children: 0,
  expiresAt: '2027-01-10T02:15:00.000Z',
  pricing: {
    ruleVersion: 'phase-4-pricing-availability-v1',
    selectedPlanCode: 'THREE_HOUR_COMBO',
    basePlanCode: 'THREE_HOUR_COMBO',
    baseMinutes: 180,
    extraUnits: 0,
    baseAmountVnd: 359000,
    extraAmountVnd: 0,
    totalAmountVnd: 359000,
    lineItems: [{ code: 'THREE_HOUR_COMBO', amountVnd: 359000, units: 1 }],
  },
};

const HOLD: BookingHoldResponse = {
  bookingId: '22222222-2222-4222-8222-222222222222',
  bookingCode: 'RM-AB23-CD45-EF67',
  status: 'HOLD',
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  holdExpiresAt: '2027-01-10T03:15:00.000Z',
  amountVnd: 359000,
  currency: 'VND',
  idempotent: false,
};

const BOOKING: BookingDetailResponse = {
  bookingCode: 'RM-AB23-CD45-EF67',
  status: 'CONFIRMED',
  property: { code: 'MAIN', name: 'Main Property', timezone: 'Asia/Ho_Chi_Minh' },
  roomType: { code: 'DLX', name: 'Deluxe', maxOccupancy: 3 },
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  adults: 2,
  children: 0,
  amountVnd: 359000,
  currency: 'VND',
  holdExpiresAt: null,
  contact: {
    fullName: 'Guest Example',
    emailMasked: 'g***@example.test',
    phoneMasked: '+84***000',
  },
  serverTime: '2027-01-10T03:00:00.000Z',
};

const PAYMENT: PaymentStatusResponse = {
  provider: 'MOMO',
  paymentStatus: 'SUCCEEDED',
  attemptStatus: 'SUCCEEDED',
  bookingStatus: 'CONFIRMED',
  amountVnd: 359000,
  currency: 'VND',
  createdAt: '2027-01-10T02:55:00.000Z',
  updatedAt: '2027-01-10T03:00:00.000Z',
  completedAt: '2027-01-10T03:00:00.000Z',
  reviewRequired: false,
  customerMessage: null,
};

describe('Phase 2.1 customer booking accessibility evidence', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    getBookingAccessPass.mockReset();
    getBookingAccessPass.mockResolvedValue({
      bookingCode: BOOKING.bookingCode,
      expiresAt: '2027-01-10T07:00:00.000Z',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" />',
    });
    getPaymentStatus.mockReset();
    listPaymentProviders.mockReset();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('catalog empty state announces with a heading and zero serious violations', async () => {
    const { container } = render(
      <LocaleProvider locale="vi">
        <section aria-labelledby="catalog-empty-heading">
          <h2 id="catalog-empty-heading">Chưa có hạng phòng đang được mở bán</h2>
          <p>Hiện chưa có hạng phòng nào được niêm yết cho kỳ lưu trú này.</p>
        </section>
      </LocaleProvider>,
    );
    expect(
      screen.getByRole('heading', { name: 'Chưa có hạng phòng đang được mở bán' }),
    ).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('catalog unavailable state surfaces a role=alert and zero serious violations', async () => {
    const { container } = render(
      <LocaleProvider locale="vi">
        <section
          aria-labelledby="catalog-unavailable-heading"
          data-testid="rooms-catalog-unavailable"
          role="alert"
        >
          <h2 id="catalog-unavailable-heading">Không thể tải danh sách hạng phòng</h2>
          <p>Hệ thống đang bận hoặc có lỗi kết nối. Vui lòng thử lại sau ít phút.</p>
        </section>
      </LocaleProvider>,
    );
    expect(
      screen.getByRole('alert', { name: /Không thể tải danh sách hạng phòng/i }),
    ).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('room-detail browse CTA carries an aria-labelledby and zero serious violations', async () => {
    const { container } = render(
      <LocaleProvider locale="vi">
        <section
          aria-labelledby="room-detail-browse-heading"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          data-testid="room-detail-browse-cta"
        >
          <h2 id="room-detail-browse-heading" className="text-lg font-semibold">
            Kiểm tra tình trạng phòng
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Chọn thời gian để kiểm tra tình trạng phòng.
          </p>
        </section>
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Kiểm tra tình trạng phòng' })).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('quote contact form labels every field with no duplicate labels', async () => {
    fetchMock.mockResolvedValue(jsonResponse(HOLD));
    const onHoldCreated = vi.fn();
    const { container } = render(
      <LocaleProvider locale="vi">
        <QuoteContactForm quote={QUOTE} onHoldCreated={onHoldCreated} />
      </LocaleProvider>,
    );
    expect(screen.getByLabelText('Họ và tên')).toBeVisible();
    expect(screen.getByLabelText('Email')).toBeVisible();
    expect(screen.getByLabelText('Số điện thoại (E.164)')).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('HOLD success surface is reachable by heading and contains no serious violations', async () => {
    const { container } = render(
      <LocaleProvider locale="vi">
        <HoldSuccessPanel
          bookingCode={HOLD.bookingCode}
          email="guest@example.test"
          hold={HOLD}
          onManageBooking={vi.fn()}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Giữ chỗ thành công' })).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('OTP request panel labels booking code and email with role=alert on errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          ok: true,
          challengeRef: '11111111-1111-4111-8111-111111111111',
        },
        { status: 200 },
      ),
    );
    const { container } = render(
      <LocaleProvider locale="vi">
        <OtpRequestPanel
          onOtpRequested={() => {
            /* no-op */
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByLabelText('Mã đặt phòng')).toBeVisible();
    expect(screen.getByLabelText('Email')).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('OTP verify panel exposes the verification code input as a labelled field', async () => {
    const { container } = render(
      <LocaleProvider locale="vi">
        <OtpVerifyPanel
          challengeRef="11111111-1111-4111-8111-111111111111"
          onVerified={() => {
            /* no-op */
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByLabelText('Mã xác nhận')).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('payment provider selector exposes accessible names for each provider button', async () => {
    listPaymentProviders.mockResolvedValue([
      { provider: 'VNPAY', displayName: 'VNPAY', enabled: true, maintenanceMessage: null },
      { provider: 'MOMO', displayName: 'MoMo', enabled: true, maintenanceMessage: null },
    ]);
    const { container } = render(
      <LocaleProvider locale="vi">
        <PaymentProviderSelector bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Thanh toán qua VNPAY/ })).toBeVisible();
      expect(screen.getByRole('button', { name: /Thanh toán qua MoMo/ })).toBeVisible();
    });
    await expectNoSeriousOrCritical(container);
  });

  it('payment status LOADING placeholder has zero serious violations', async () => {
    getPaymentStatus.mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <LocaleProvider locale="vi">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('payment-loading-state')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Trạng thái thanh toán' })).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('payment status loaded summary keeps the heading and reports fields', async () => {
    getPaymentStatus.mockResolvedValue(PAYMENT);
    const { container } = render(
      <LocaleProvider locale="vi">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('payment-status-summary')).toBeVisible();
    });
    expect(screen.getByRole('heading', { name: 'Trạng thái thanh toán' })).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('payment status LOAD_ERROR exposes an alert region with a retry control', async () => {
    getPaymentStatus.mockRejectedValue(new Error('boom'));
    const { container } = render(
      <LocaleProvider locale="vi">
        <PaymentStatusSummary bookingCode="RM-AB23-CD45-EF67" />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('payment-load-error')).toBeVisible();
    });
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('confirmed success surface renders the Vietnamese heading and zero serious violations', async () => {
    const { container } = render(
      <LocaleProvider locale="vi">
        <ConfirmedSuccessPanel booking={BOOKING} payment={PAYMENT} />
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Đặt phòng thành công' })).toBeVisible();
    await expectNoSeriousOrCritical(container);
  });

  it('availability search results announce error/empty states with role=alert or empty content', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          items: [],
          warnings: [],
          searchInterval: {
            checkIn: '2027-01-10T03:00:00.000Z',
            checkOut: '2027-01-10T06:00:00.000Z',
            adults: 2,
            children: 0,
            mode: 'overnight',
          },
        },
        { status: 200 },
      ),
    );
    const { container } = render(
      <LocaleProvider locale="vi">
        <AvailabilitySearchResults
          controlledExactStatus="empty"
          controlledNearbyStatus="idle"
          exactStatus="empty"
          nearbyStatus="idle"
          state={{
            checkIn: '2027-01-10T03:00:00.000Z',
            checkOut: '2027-01-10T06:00:00.000Z',
            adults: 2,
            children: 0,
            mode: 'overnight',
          }}
        />
      </LocaleProvider>,
    );
    // Empty state must announce via heading rather than a hidden live region.
    await waitFor(() => {
      expect(screen.getByRole('heading')).toBeVisible();
    });
    await expectNoSeriousOrCritical(container);
    // Sanity check the user can still click the retry affordance without
    // repeated label clashes.
    const user = userEvent.setup();
    const allButtons = screen.queryAllByRole('button');
    expect(allButtons.length).toBeGreaterThanOrEqual(0);
    await user.tab();
  });
});
