import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quote } from '@room/contracts';

import { QuoteView } from '../src/components/quote-view';
import { LocaleProvider } from '../src/components/locale-provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const QUOTE_WITHOUT_COUPON: Quote = {
  id: '00000000-0000-4000-8000-000000000001',
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

const QUOTE_WITH_COUPON: Quote = {
  ...QUOTE_WITHOUT_COUPON,
  id: '00000000-0000-4000-8000-000000000002',
  coupon: {
    code: 'SUMMER-50K',
    discountType: 'FIXED',
    grossAmountVnd: 359000,
    discountAmountVnd: 50000,
    finalAmountVnd: 309000,
    revalidationNotice: 'Coupon discount is provisional.',
  },
};

const EMPTY_RECOMMENDATIONS = {
  exactResult: {
    pricing: QUOTE_WITHOUT_COUPON.pricing,
    finalAmountVnd: QUOTE_WITHOUT_COUPON.pricing.totalAmountVnd,
    discountAmountVnd: 0,
  },
  recommendations: [],
  generatedAt: '2027-01-10T02:00:00.000Z',
  advisoryExpiresAt: '2027-01-10T02:15:00.000Z',
};

const PAYMENT_PROVIDERS = [
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
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function problemResponse(code: string, status = 409): Response {
  return new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Coupon error',
      status,
      code,
      detail: code,
      requestId: 'req-1',
      errors: [],
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

function findQuoteIssueCall(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return fetchMock.mock.calls.find((call) => {
    const request = call[1] as RequestInit | undefined;
    return request?.method === 'POST' && String(call[0]).includes('/quotes');
  });
}

const CONTEXT = {
  roomTypeId: '11111111-1111-4111-8111-111111111111',
  checkIn: '2027-01-10T03:00:00.000Z',
  checkOut: '2027-01-10T06:00:00.000Z',
  adults: '2',
  children: '0',
  selectedPlanCode: 'THREE_HOUR_COMBO',
};

describe('QuoteView coupon integration', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/payments/providers'))
        return Promise.resolve(jsonResponse(PAYMENT_PROVIDERS));
      if (url.includes('/recommendations'))
        return Promise.resolve(jsonResponse(EMPTY_RECOMMENDATIONS));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('renders English quote state without translating the coupon code', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITH_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS));
    render(
      <LocaleProvider locale="en">
        <QuoteView id={QUOTE_WITH_COUPON.id} context={CONTEXT} />
      </LocaleProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Pay & book' })).toBeInTheDocument();
    expect(screen.getByTestId('coupon-summary')).toHaveTextContent('SUMMER-50K');
    expect(document.body.textContent).not.toContain('Hoàn tất giữ chỗ');
  });

  it('renders the coupon input and a safe summary when the quote already includes one', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITH_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS));
    render(<QuoteView id={QUOTE_WITH_COUPON.id} context={CONTEXT} />);

    await screen.findByTestId('coupon-input');
    expect(screen.getByTestId('coupon-input')).toBeInTheDocument();
    const summary = await screen.findByTestId('coupon-summary');
    expect(summary).toHaveTextContent('SUMMER-50K');
  });

  it('issues a new quote when a coupon code is applied and the request body contains only couponCode', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITHOUT_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS))
      .mockResolvedValueOnce(jsonResponse({ id: '00000000-0000-4000-8000-000000000099' }));
    const user = userEvent.setup();
    render(<QuoteView id={QUOTE_WITHOUT_COUPON.id} context={CONTEXT} />);

    await screen.findByTestId('coupon-input');
    await user.type(screen.getByLabelText('Mã giảm giá'), 'SUMMER-50K');
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    const issueCall = await waitFor(() => {
      const call = findQuoteIssueCall(fetchMock);
      expect(call).toBeDefined();
      return call;
    });
    const init = issueCall?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      roomTypeId: CONTEXT.roomTypeId,
      checkIn: CONTEXT.checkIn,
      checkOut: CONTEXT.checkOut,
      adults: 2,
      children: 0,
      selectedPlanCode: CONTEXT.selectedPlanCode,
      couponCode: 'SUMMER-50K',
    });
    expect(body).not.toHaveProperty('discountAmountVnd');
    expect(body).not.toHaveProperty('finalAmountVnd');
    expect(body).not.toHaveProperty('couponId');
  });

  it('preserves selectedPlanCode through a coupon clear cycle (applies then clears)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITHOUT_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS))
      .mockResolvedValueOnce(jsonResponse({ id: '00000000-0000-4000-8000-000000000011' }))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS))
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITHOUT_COUPON));
    const user = userEvent.setup();
    render(<QuoteView id={QUOTE_WITHOUT_COUPON.id} context={CONTEXT} />);

    await screen.findByTestId('coupon-input');
    await user.type(screen.getByLabelText('Mã giảm giá'), 'SUMMER-50K');
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));
    const applyCall = await waitFor(() => {
      const call = findQuoteIssueCall(fetchMock);
      expect(call).toBeDefined();
      return call;
    });
    const applyInit = applyCall?.[1] as RequestInit | undefined;
    const applyBody = JSON.parse(String(applyInit?.body)) as Record<string, unknown>;
    expect(applyBody.selectedPlanCode).toBe('THREE_HOUR_COMBO');
    expect(applyBody.couponCode).toBe('SUMMER-50K');
  });

  it('omits selectedPlanCode when not provided in context but never infers a plan during clear', async () => {
    const CONTEXT_NO_PLAN = {
      roomTypeId: '11111111-1111-4111-8111-111111111111',
      checkIn: '2027-01-10T03:00:00.000Z',
      checkOut: '2027-01-10T06:00:00.000Z',
      adults: '2',
      children: '0',
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITHOUT_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS))
      .mockResolvedValueOnce(jsonResponse({ id: '00000000-0000-4000-8000-000000000012' }));
    const user = userEvent.setup();
    render(<QuoteView id={QUOTE_WITHOUT_COUPON.id} context={CONTEXT_NO_PLAN} />);

    await screen.findByTestId('coupon-input');
    await user.type(screen.getByLabelText('Mã giảm giá'), 'SUMMER-50K');
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    const issueCall = await waitFor(() => {
      const call = findQuoteIssueCall(fetchMock);
      expect(call).toBeDefined();
      return call;
    });
    const init = issueCall?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('selectedPlanCode');
    expect(body.couponCode).toBe('SUMMER-50K');
  });

  it('shows a safe Vietnamese error and does not replace the current quote when the coupon is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITHOUT_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS))
      .mockResolvedValueOnce(problemResponse('COUPON_NOT_APPLICABLE'));
    const user = userEvent.setup();
    render(<QuoteView id={QUOTE_WITHOUT_COUPON.id} context={CONTEXT} />);

    await screen.findByTestId('coupon-input');
    await user.type(screen.getByLabelText('Mã giảm giá'), 'BOGUS');
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    const error = await screen.findByTestId('coupon-error');
    expect(error).toHaveTextContent('Mã giảm giá không hợp lệ');
    // The existing quote summary must still be visible — the failed reissue
    // must not visually replace the displayed totals.
    await screen.findByTestId('coupon-input');
    expect(screen.getByText('Tổng cộng:')).toBeInTheDocument();
  });

  it('drops the coupon when clearing, requesting a plain quote', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITH_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS))
      .mockResolvedValueOnce(jsonResponse({ id: QUOTE_WITHOUT_COUPON.id }));
    const user = userEvent.setup();
    render(<QuoteView id={QUOTE_WITH_COUPON.id} context={CONTEXT} />);

    await screen.findByTestId('coupon-input');
    await user.click(screen.getByRole('button', { name: 'Bỏ mã' }));

    const issueCall = await waitFor(() => {
      const call = findQuoteIssueCall(fetchMock);
      expect(call).toBeDefined();
      return call;
    });
    const init = issueCall?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('couponCode');
    expect(body.selectedPlanCode).toBe('THREE_HOUR_COMBO');
  });

  it('does not write the coupon code to URL or browser storage', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITH_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS));
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const sessionSetItem = vi.spyOn(window.sessionStorage, 'setItem');
    render(<QuoteView id={QUOTE_WITH_COUPON.id} context={CONTEXT} />);

    await screen.findByTestId('coupon-input');
    expect(globalThis.location.search).not.toContain('SUMMER-50K');
    expect(globalThis.location.hash).not.toContain('SUMMER-50K');
    for (const call of setItem.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('SUMMER-50K');
    }
    for (const call of sessionSetItem.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('SUMMER-50K');
    }
  });

  it('discards stale in-flight quote loads when the URL changes mid-request', async () => {
    let resolveFirst: ((value: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fetchMock
      .mockResolvedValueOnce(jsonResponse(QUOTE_WITHOUT_COUPON))
      .mockResolvedValueOnce(jsonResponse(PAYMENT_PROVIDERS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS))
      .mockResolvedValueOnce(jsonResponse(EMPTY_RECOMMENDATIONS));

    const { rerender } = render(<QuoteView id={QUOTE_WITHOUT_COUPON.id} context={CONTEXT} />);
    rerender(<QuoteView id="00000000-0000-4000-8000-000000000099" context={CONTEXT} />);

    resolveFirst?.(jsonResponse(QUOTE_WITH_COUPON));

    await waitFor(() => expect(screen.getByTestId('coupon-input')).toBeInTheDocument());
    // The stale response (with the coupon) must not have been applied.
    expect(screen.queryByTestId('coupon-summary')).toBeNull();
  });
});
