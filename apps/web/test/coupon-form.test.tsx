import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Coupon } from '@room/contracts';

import { CouponForm } from '../src/components/coupon-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const ROOM_TYPE_A = '11111111-1111-4111-8111-111111111111';
const ROOM_TYPE_B = '22222222-2222-4222-8222-222222222222';

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

function makeCreatedCoupon(code: string): Coupon {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    propertyId: '00000000-0000-4000-8000-000000000099',
    code,
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

async function fillFormBaseFields(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> {
  await user.type(screen.getByLabelText('Mã coupon'), code);
  // Use a future window so the contract's validFrom<validUntil invariant passes.
  await user.type(screen.getByLabelText('Hiệu lực từ'), '2027-06-01T10:00');
  await user.type(screen.getByLabelText('Hiệu lực đến'), '2027-12-31T10:00');
}

describe('CouponForm admin authority and request contract', () => {
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

  it('submits an exact FIXED payload with all room types when the FIXED radio is selected', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          page: 1,
          pageSize: 100,
          items: [
            { id: ROOM_TYPE_A, name: 'Deluxe' },
            { id: ROOM_TYPE_B, name: 'Suite' },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(makeCreatedCoupon('FIXED-SUMMER-50K'), 201));
    const user = userEvent.setup();
    render(<CouponForm />);

    // Default scope is "all room types" — no need to opt out. Just fill and submit.
    await fillFormBaseFields(user, 'FIXED-SUMMER-50K');
    await user.type(screen.getByLabelText('Số tiền VND'), '50000');
    await user.click(screen.getByRole('button', { name: 'Tạo coupon' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const createCall = fetchMock.mock.calls[1];
    expect(createCall?.[0]).toBe('http://api.local/api/v1/admin/coupons');
    expect((createCall?.[1] as RequestInit).method).toBe('POST');
    const body = JSON.parse(String((createCall?.[1] as RequestInit).body)) as Record<
      string,
      unknown
    >;
    expect(body.code).toBe('FIXED-SUMMER-50K');
    expect(body.discountType).toBe('FIXED');
    expect(body.fixedAmountVnd).toBe(50_000);
    expect(body.minimumOrderAmountVnd).toBe(0);
    expect(body.totalUsageLimit).toBeNull();
    expect(body.perCustomerLimit).toBeNull();
    expect(body.roomTypes).toEqual({ all: true });
    expect(typeof body.validFrom).toBe('string');
    expect(typeof body.validUntil).toBe('string');
    expect(body).not.toHaveProperty('percentageBasisPoints');
    expect(body).not.toHaveProperty('maximumDiscountVnd');
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('firstReferencedAt');
    expect(body).not.toHaveProperty('disabledAt');
    expect(body).not.toHaveProperty('counts');
  });

  it('blocks submission when a specific room type scope has no roomTypeIds selected', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        page: 1,
        pageSize: 100,
        items: [{ id: ROOM_TYPE_A, name: 'Deluxe' }],
      }),
    );
    const user = userEvent.setup();
    render(<CouponForm />);

    await user.click(screen.getByLabelText('Tất cả loại phòng'));
    await screen.findByLabelText('Deluxe');
    await fillFormBaseFields(user, 'NO-ROOM-TYPE');
    await user.type(screen.getByLabelText('Số tiền VND'), '50000');
    // DO NOT check any room — submit must be rejected client-side.
    await user.click(screen.getByRole('button', { name: 'Tạo coupon' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vui lòng kiểm tra mã, thời gian, số tiền và giới hạn sử dụng.',
    );
  });

  it('maps a duplicate-code 409 to a safe Vietnamese message and never retries automatically', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          page: 1,
          pageSize: 100,
          items: [{ id: ROOM_TYPE_A, name: 'Deluxe' }],
        }),
      )
      .mockResolvedValueOnce(problemResponse('COUPON_CODE_DUPLICATE', 409));
    const user = userEvent.setup();
    render(<CouponForm />);

    // Keep the default "all room types" scope so validity passes.
    await fillFormBaseFields(user, 'DUPLICATE-CODE');
    await user.type(screen.getByLabelText('Số tiền VND'), '50000');
    await user.click(screen.getByRole('button', { name: 'Tạo coupon' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Mã coupon đã tồn tại/);
    // Exactly one create attempt — no automatic retry.
    const createCalls = fetchMock.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        (call[0] as string).endsWith('/admin/coupons') &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(createCalls).toHaveLength(1);
  });
});
