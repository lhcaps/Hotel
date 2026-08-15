import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AvailabilityOfferResponse, ProblemDetails } from '@room/contracts';

import { RoomDetailQuoteAction } from '../src/components/room-detail-quote-action';
import { AdminApiError } from '../src/lib/admin-api';
import { LocaleProvider } from '../src/components/locale-provider';

const ROOM_TYPE_ID = '11111111-1111-4111-8111-111111111111';
const CHECK_IN = '2027-01-10T14:00:00+07:00';
const CHECK_OUT = '2027-01-10T17:00:00+07:00';
const SEARCH = `checkIn=${encodeURIComponent(CHECK_IN)}&checkOut=${encodeURIComponent(CHECK_OUT)}&adults=2&children=0`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function problemResponse(overrides: Partial<ProblemDetails>): Response {
  const body: ProblemDetails = {
    type: 'validation-error',
    title: 'Invalid request',
    status: 400,
    code: 'VALIDATION_ERROR',
    detail: 'One or more request fields are invalid.',
    requestId: 'req-quote-400',
    errors: [],
    ...overrides,
  };
  return jsonResponse(body, 400);
}

const VALID_OFFER: AvailabilityOfferResponse = {
  items: [
    {
      planCode: 'THREE_HOUR_COMBO',
      planLabel: '3-hour stay',
      includedDurationMinutes: 180,
      extraUnits: 0,
      totalAmountVnd: 359000,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
    },
  ],
};

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('RoomDetailQuoteAction', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.local/api/v1';
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('POSTs /quotes/offers with the exact payload preserved from the URL state', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_OFFER));
    render(
      <LocaleProvider locale="en">
        <RoomDetailQuoteAction roomTypeId={ROOM_TYPE_ID} search={SEARCH} />
      </LocaleProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0] ?? [];
    expect(call[0]).toBe('http://api.local/api/v1/quotes/offers');
    const init = call[1] as RequestInit | undefined;
    expect(init?.method).toBe('POST');
    expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({
      roomTypeId: ROOM_TYPE_ID,
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      adults: 2,
      children: 0,
    });
    expect(await screen.findByTestId('room-detail-composed-price')).toBeInTheDocument();
  });

  it('surfaces the exact localized Vietnamese message for a VALIDATION_ERROR on adults', async () => {
    fetchMock.mockResolvedValueOnce(
      problemResponse({
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'adults', message: 'Number must be greater than or equal to 1' }],
      }),
    );
    render(
      <LocaleProvider locale="vi">
        <RoomDetailQuoteAction roomTypeId={ROOM_TYPE_ID} search={SEARCH} />
      </LocaleProvider>,
    );

    const alert = await screen.findByTestId('room-detail-quote-error-field');
    expect(alert).toHaveTextContent('Số người lớn không hợp lệ.');
    expect(alert.textContent ?? '').not.toContain('Hạng phòng có thể vừa thay đổi tình trạng');
  });

  it('surfaces the exact localized Vietnamese message for a VALIDATION_ERROR on interval', async () => {
    fetchMock.mockResolvedValueOnce(
      problemResponse({
        code: 'INVALID_PRICING_INTERVAL',
        errors: [
          {
            field: 'checkOut',
            message: 'Stay duration must be greater than zero and no longer than 31 days.',
          },
        ],
      }),
    );
    render(
      <LocaleProvider locale="vi">
        <RoomDetailQuoteAction roomTypeId={ROOM_TYPE_ID} search={SEARCH} />
      </LocaleProvider>,
    );

    const alert = await screen.findByTestId('room-detail-quote-error-field');
    expect(alert).toHaveTextContent('Thời gian lưu trú không hợp lệ. Vui lòng chọn lại thời gian.');
  });

  it('surfaces the exact localized Vietnamese message for an invalid roomTypeId', async () => {
    fetchMock.mockResolvedValueOnce(
      problemResponse({
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'roomTypeId', message: 'Invalid uuid' }],
      }),
    );
    render(
      <LocaleProvider locale="vi">
        <RoomDetailQuoteAction roomTypeId="not-a-uuid" search={SEARCH} />
      </LocaleProvider>,
    );

    const alert = await screen.findByTestId('room-detail-quote-error-field');
    expect(alert).toHaveTextContent(
      'Thông tin loại phòng không hợp lệ. Vui lòng quay lại chọn phòng.',
    );
  });

  it('renders the sold-out friendly state (no destructive variant) for NO_CONTINUOUS_ROOM', async () => {
    fetchMock.mockResolvedValueOnce(
      problemResponse({
        type: 'availability-unavailable',
        code: 'NO_CONTINUOUS_ROOM',
        detail: 'No continuous room for this interval.',
      }),
    );
    render(
      <LocaleProvider locale="vi">
        <RoomDetailQuoteAction roomTypeId={ROOM_TYPE_ID} search={SEARCH} />
      </LocaleProvider>,
    );

    const alert = await screen.findByTestId('room-detail-quote-error-availability');
    expect(alert).toHaveTextContent('vừa hết phòng');
    expect(alert.textContent ?? '').toContain('Kiểm tra ngày khác');
  });

  it('renders a system error for non-AdminApiError failures', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    render(
      <LocaleProvider locale="en">
        <RoomDetailQuoteAction roomTypeId={ROOM_TYPE_ID} search={SEARCH} />
      </LocaleProvider>,
    );

    const alert = await screen.findByTestId('room-detail-quote-error-system');
    expect(alert).toHaveTextContent('Could not load the quote');
  });
});
