import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Coupon } from '@room/contracts';

import { CouponDetail } from '../src/components/coupon-detail';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const COUPON_ID = '00000000-0000-4000-8000-000000000001';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function problemResponse(code: string, status: number): Response {
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

function makeActiveCoupon(): Coupon {
  return {
    id: COUPON_ID,
    propertyId: '00000000-0000-4000-8000-000000000099',
    code: 'SUMMER-50K',
    status: 'ACTIVE',
    lifecycle: 'AVAILABLE',
    discountType: 'FIXED',
    fixedAmountVnd: 50_000,
    percentageBasisPoints: null,
    maximumDiscountVnd: null,
    minimumOrderAmountVnd: 0,
    validFrom: '2027-01-10T00:00:00.000Z',
    validUntil: '2027-12-31T23:59:59.000Z',
    appliesToAllRoomTypes: true,
    roomTypeIds: [],
    totalUsageLimit: null,
    perCustomerLimit: null,
    counts: { activeReservations: 0, redeemed: 0, released: 0 },
    createdAt: '2027-01-01T00:00:00.000Z',
    updatedAt: '2027-01-01T00:00:00.000Z',
    disabledAt: null,
  };
}

function makeDisabledCoupon(): Coupon {
  return {
    ...makeActiveCoupon(),
    status: 'DISABLED',
    lifecycle: 'DISABLED',
    disabledAt: '2027-02-01T10:00:00.000Z',
  };
}

describe('CouponDetail authority and disable behaviour', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let confirmSpy: ReturnType<typeof vi.spyOn<typeof globalThis, 'confirm'>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('exposes a disable action only when the coupon is ACTIVE', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeActiveCoupon()));
    render(<CouponDetail id={COUPON_ID} />);

    expect(await screen.findByRole('heading', { name: 'SUMMER-50K' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vô hiệu hóa coupon' })).toBeInTheDocument();
  });

  it('renders no re-enable action when the coupon is DISABLED', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeDisabledCoupon()));
    render(<CouponDetail id={COUPON_ID} />);

    expect(await screen.findByRole('heading', { name: 'SUMMER-50K' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vô hiệu hóa coupon' })).toBeNull();
    // No "Kích hoạt lại" / re-enable button of any kind is exposed.
    expect(screen.queryByRole('button', { name: /kích hoạt lại/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /enable/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /re-?enable/i })).toBeNull();
    expect(screen.getByText('DISABLED')).toBeInTheDocument();
  });

  it('sends exactly one disable request when the user confirms, and the button is disabled while pending', async () => {
    let resolveDisable: ((value: Response) => void) | undefined;
    fetchMock.mockResolvedValueOnce(jsonResponse(makeActiveCoupon())).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveDisable = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<CouponDetail id={COUPON_ID} />);

    const button = await screen.findByRole('button', { name: 'Vô hiệu hóa coupon' });
    await user.click(button);

    // The button must become disabled while the request is in flight, so a
    // second click cannot fire another POST. waitFor polls until React commits
    // the pending state.
    await waitFor(() => {
      const pendingButton = screen.getByRole('button', { name: 'Vô hiệu hóa coupon' });
      expect(pendingButton).toBeDisabled();
    });
    const pendingButton = screen.getByRole('button', { name: 'Vô hiệu hóa coupon' });
    await user.click(pendingButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // Two calls: the initial GET and exactly one POST /disable.
    const disableCalls = fetchMock.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        (call[0] as string).endsWith(`/admin/coupons/${COUPON_ID}/disable`) &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(disableCalls).toHaveLength(1);
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    // Resolve the in-flight request with a 200 so the cleanup runs cleanly.
    resolveDisable?.(jsonResponse(makeDisabledCoupon()));
  });

  it('never renders customer digests, contact data, or redemption events in the DOM', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeActiveCoupon()));
    const { container } = render(<CouponDetail id={COUPON_ID} />);

    await screen.findByRole('heading', { name: 'SUMMER-50K' });
    const html = container.innerHTML;
    expect(html).not.toMatch(/guest/i);
    expect(html).not.toMatch(/digest/i);
    expect(html).not.toMatch(/email/i);
    expect(html).not.toMatch(/phone/i);
    expect(html).not.toMatch(/redemption/i);
    expect(html).not.toMatch(/firstReferencedAt/i);
    expect(html).not.toMatch(/redeemedAt/i);
    expect(html).not.toMatch(/contact/i);
  });

  it('surfaces a safe Vietnamese error when the coupon cannot be loaded', async () => {
    fetchMock.mockResolvedValueOnce(problemResponse('COUPON_FORBIDDEN', 403));
    render(<CouponDetail id={COUPON_ID} />);

    expect(await screen.findByText('Bạn không có quyền xem coupon.')).toBeInTheDocument();
  });
});
