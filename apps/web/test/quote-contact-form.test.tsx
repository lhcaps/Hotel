import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quote } from '@room/contracts';

import { QuoteContactForm } from '../src/components/quote-contact-form';
import { LocaleProvider } from '../src/components/locale-provider';

function makeQuote(): Quote {
  return {
    id: 'quote-id-1',
    roomTypeId: '11111111-1111-4111-8111-111111111111',
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
}

describe('QuoteContactForm', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('uses English labels and validation messages while preserving contact data', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider locale="en">
        <QuoteContactForm quote={makeQuote()} onHoldCreated={vi.fn()} />
      </LocaleProvider>,
    );

    await user.type(screen.getByLabelText('Full name'), 'A');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Hold room' }));

    expect(await screen.findByText('Email is invalid.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Thông tin liên hệ');
  });

  it('submits valid contact data to the HOLD endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          bookingId: '22222222-2222-4222-8222-222222222222',
          bookingCode: 'RM-AB23-CD45-EF67',
          status: 'HOLD',
          checkIn: '2027-01-10T03:00:00.000Z',
          checkOut: '2027-01-10T06:00:00.000Z',
          holdExpiresAt: '2027-01-10T03:15:00.000Z',
          amountVnd: 359000,
          currency: 'VND',
          idempotent: false,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    const onHoldCreated = vi.fn();
    const user = userEvent.setup();
    render(<QuoteContactForm quote={makeQuote()} onHoldCreated={onHoldCreated} />);

    await user.type(screen.getByLabelText('Họ và tên'), 'Nguyen Van A');
    await user.type(screen.getByLabelText('Email'), 'guest@example.test');
    await user.clear(screen.getByLabelText(/Số điện thoại/));
    await user.type(screen.getByLabelText(/Số điện thoại/), '+84909000000');
    await user.click(screen.getByRole('button', { name: 'Giữ chỗ' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      contact: {
        fullName: 'Nguyen Van A',
        email: 'guest@example.test',
        phone: '+84909000000',
      },
    });
    expect(onHoldCreated).toHaveBeenCalledTimes(1);
    const [hold, email] = onHoldCreated.mock.calls[0] as readonly [unknown, string];
    expect(email).toBe('guest@example.test');
    expect(hold).toMatchObject({ bookingCode: 'RM-AB23-CD45-EF67', status: 'HOLD' });
  });

  it('keeps the reservation internal while starting the selected demo payment checkout', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              provider: 'MOMO',
              displayName: 'MoMo Demo',
              displayOrder: 1,
              checkoutExpiryMinutes: 15,
              maintenanceMessage: null,
              enabled: true,
              unavailableReason: null,
            },
            {
              provider: 'VNPAY',
              displayName: 'VNPAY Demo',
              displayOrder: 2,
              checkoutExpiryMinutes: 15,
              maintenanceMessage: null,
              enabled: true,
              unavailableReason: null,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            bookingId: '22222222-2222-4222-8222-222222222222',
            bookingCode: 'RM-AB23-CD45-EF67',
            status: 'HOLD',
            checkIn: '2099-01-10T03:00:00.000Z',
            checkOut: '2099-01-10T06:00:00.000Z',
            holdExpiresAt: '2099-01-10T03:15:00.000Z',
            amountVnd: 359000,
            currency: 'VND',
            idempotent: false,
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            paymentId: '33333333-3333-4333-8333-333333333333',
            paymentAttemptId: '44444444-4444-4444-8444-444444444444',
            provider: 'MOMO',
            status: 'PENDING',
            redirectUrl: 'https://pay.example.test/momo-demo/checkout?reference=safe-reference',
            expiresAt: '2099-01-10T03:15:00.000Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const onCheckoutStarted = vi.fn();
    const user = userEvent.setup();
    render(<QuoteContactForm quote={makeQuote()} onCheckoutStarted={onCheckoutStarted} />);

    await user.click(await screen.findByRole('radio', { name: 'MoMo Demo' }));
    await user.type(screen.getByLabelText('Họ và tên'), 'Nguyen Van A');
    await user.type(screen.getByLabelText('Email'), 'guest@example.test');
    await user.clear(screen.getByLabelText(/Số điện thoại/));
    await user.type(screen.getByLabelText(/Số điện thoại/), '+84909000000');
    await user.click(screen.getByRole('button', { name: 'Thanh toán & đặt phòng' }));

    await waitFor(() => expect(onCheckoutStarted).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/public/quotes/quote-id-1/bookings');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain(
      '/public/bookings/RM-AB23-CD45-EF67/payments/momo/attempts',
    );
    const paymentInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(paymentInit.headers).toMatchObject({ 'idempotency-key': expect.any(String) });
    expect(document.body.textContent).not.toMatch(/Giữ chỗ|Hoàn tất giữ chỗ/);
  });

  it('blocks invalid email client-side and surfaces server errors safely', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'about:blank',
          title: 'Quote expired',
          status: 410,
          code: 'QUOTE_EXPIRED',
          detail: 'Quote expired',
          requestId: 'req-3',
          errors: [],
        }),
        { status: 410, headers: { 'content-type': 'application/json' } },
      ),
    );
    const onHoldCreated = vi.fn();
    const user = userEvent.setup();
    render(<QuoteContactForm quote={makeQuote()} onHoldCreated={onHoldCreated} />);

    await user.type(screen.getByLabelText('Họ và tên'), 'A');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.clear(screen.getByLabelText(/Số điện thoại/));
    await user.type(screen.getByLabelText(/Số điện thoại/), '+84909000000');
    await user.click(screen.getByRole('button', { name: 'Giữ chỗ' }));

    expect(await screen.findByText('Email không hợp lệ.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'about:blank',
          title: 'Quote expired',
          status: 410,
          code: 'QUOTE_EXPIRED',
          detail: 'Quote expired',
          requestId: 'req-3',
          errors: [],
        }),
        { status: 410, headers: { 'content-type': 'application/json' } },
      ),
    );
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'guest@example.test');
    await user.click(screen.getByRole('button', { name: 'Giữ chỗ' }));

    expect(
      await screen.findByText('Báo giá đã hết hạn. Vui lòng tạo báo giá mới.'),
    ).toBeInTheDocument();
    expect(onHoldCreated).not.toHaveBeenCalled();
  });

  it('shows E.164 phone guidance', async () => {
    render(<QuoteContactForm quote={makeQuote()} onHoldCreated={vi.fn()} />);
    expect(screen.getByText(/Sử dụng định dạng E\.164/)).toBeInTheDocument();
    const phone = screen.getByLabelText(/Số điện thoại/);
    expect(phone.getAttribute('inputmode')).toBe('tel');
  });

  it('prevents double submit while the request is in flight', async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const onHoldCreated = vi.fn();
    const user = userEvent.setup();
    render(<QuoteContactForm quote={makeQuote()} onHoldCreated={onHoldCreated} />);

    await user.type(screen.getByLabelText('Họ và tên'), 'A');
    await user.type(screen.getByLabelText('Email'), 'guest@example.test');
    await user.clear(screen.getByLabelText(/Số điện thoại/));
    await user.type(screen.getByLabelText(/Số điện thoại/), '+84909000000');

    const button = screen.getByRole('button', { name: 'Giữ chỗ' });
    await user.click(button);
    await user.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const pendingButton = await screen.findByRole('button', { name: 'Đang giữ chỗ…' });
    expect(pendingButton.hasAttribute('disabled')).toBe(true);

    resolveRequest?.(
      new Response(
        JSON.stringify({
          bookingId: '22222222-2222-4222-8222-222222222222',
          bookingCode: 'RM-AB23-CD45-EF67',
          status: 'HOLD',
          checkIn: '2027-01-10T03:00:00.000Z',
          checkOut: '2027-01-10T06:00:00.000Z',
          holdExpiresAt: '2027-01-10T03:15:00.000Z',
          amountVnd: 359000,
          currency: 'VND',
          idempotent: false,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
  });

  it('writes no contact data to browser storage', async () => {
    const onHoldCreated = vi.fn();
    render(<QuoteContactForm quote={makeQuote()} onHoldCreated={onHoldCreated} />);
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const sessionSetItem = vi.spyOn(window.sessionStorage, 'setItem');
    expect(setItem).not.toHaveBeenCalled();
    expect(sessionSetItem).not.toHaveBeenCalled();
  });

  it('renders an accessible form with no violations', async () => {
    const { container } = render(<QuoteContactForm quote={makeQuote()} onHoldCreated={vi.fn()} />);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
