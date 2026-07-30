import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecommendationResponse } from '@room/contracts';

import { StayTimeRecommendations } from '../src/components/stay-time-recommendations';
import { LocaleProvider } from '../src/components/locale-provider';

const SAMPLE_RESPONSE: RecommendationResponse = {
  exactResult: {
    pricing: {
      ruleVersion: 'phase-8b-cheapest-eligible-pricing-v1',
      selectedPlanCode: 'THREE_HOUR_COMBO',
      basePlanCode: 'THREE_HOUR_COMBO',
      baseMinutes: 180,
      extraUnits: 0,
      baseAmountVnd: 359000,
      extraAmountVnd: 0,
      totalAmountVnd: 359000,
      lineItems: [{ code: 'THREE_HOUR_COMBO', amountVnd: 359000, units: 1 }],
    },
    finalAmountVnd: 359000,
    discountAmountVnd: 0,
  },
  recommendations: [
    {
      checkIn: '2027-01-10T02:00:00.000Z',
      checkOut: '2027-01-10T05:00:00.000Z',
      shiftMinutes: -45,
      selectedPlanCode: 'FIVE_HOUR_COMBO',
      grossAmountVnd: 459000,
      discountAmountVnd: 60000,
      finalAmountVnd: 299000,
      savingsVnd: 60000,
      availabilityStatus: 'AVAILABLE',
      category: 'CHEAPEST_NEARBY',
    },
  ],
  generatedAt: '2027-01-10T03:00:00.000Z',
  advisoryExpiresAt: '2027-01-10T03:15:00.000Z',
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('StayTimeRecommendations', () => {
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

  it('loads English recommendations automatically with customer-facing plan names', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SAMPLE_RESPONSE));
    render(
      <LocaleProvider locale="en">
        <StayTimeRecommendations
          roomTypeId="00000000-0000-0000-0000-000000000001"
          checkIn="2027-01-10T03:00:00.000Z"
          checkOut="2027-01-10T06:00:00.000Z"
          adults={2}
          children={0}
        />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Cheaper nearby times' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('5-hour stay')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Khung giờ thay thế rẻ hơn');
    expect(document.body.textContent).not.toContain('FIVE_HOUR_COMBO');
  });

  it('POSTs automatically to /recommendations/stay-times with the expected payload', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SAMPLE_RESPONSE));
    render(
      <StayTimeRecommendations
        roomTypeId="00000000-0000-0000-0000-000000000001"
        checkIn="2027-01-10T03:00:00.000Z"
        checkOut="2027-01-10T06:00:00.000Z"
        adults={2}
        children={0}
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0] ?? [];
    expect(call[0]).toBe('http://api.local/api/v1/recommendations/stay-times');
    const init = call[1] as RequestInit | undefined;
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({
      roomTypeId: '00000000-0000-0000-0000-000000000001',
      checkIn: '2027-01-10T03:00:00.000Z',
      checkOut: '2027-01-10T06:00:00.000Z',
      adults: 2,
      children: 0,
    });
  });

  it('forwards couponCode only when present', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SAMPLE_RESPONSE));
    render(
      <StayTimeRecommendations
        roomTypeId="00000000-0000-0000-0000-000000000001"
        checkIn="2027-01-10T03:00:00.000Z"
        checkOut="2027-01-10T06:00:00.000Z"
        adults={2}
        children={0}
        couponCode="SUMMER10"
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(
        ((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body as string) ?? '{}',
      ).couponCode,
    ).toBe('SUMMER10');
  });

  it('issues a new quote and navigates to its page when a candidate is chosen', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SAMPLE_RESPONSE));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'q-xyz' }));
    const user = userEvent.setup();
    render(
      <StayTimeRecommendations
        roomTypeId="00000000-0000-0000-0000-000000000001"
        checkIn="2027-01-10T03:00:00.000Z"
        checkOut="2027-01-10T06:00:00.000Z"
        adults={2}
        children={0}
      />,
    );
    expect(await screen.findByText(/sớm hơn 45 phút/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chọn khung giờ này' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const reissueCall = fetchMock.mock.calls[1] ?? [];
    expect(reissueCall[0]).toBe('http://api.local/api/v1/quotes');
    const reissueBody = JSON.parse(
      ((reissueCall[1] as RequestInit | undefined)?.body as string) ?? '{}',
    ) as Record<string, unknown>;
    expect(reissueBody.checkIn).toBe('2027-01-10T02:00:00.000Z');
    expect(reissueBody.checkOut).toBe('2027-01-10T05:00:00.000Z');
    const target = pushMock.mock.calls[0]?.[0] as string;
    const parsed = new URL(target, 'http://test.local');
    expect(parsed.pathname).toBe('/booking/quote/q-xyz');
  });

  it('shows a retryable safe error and a concise empty state', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    const { rerender } = render(
      <StayTimeRecommendations
        roomTypeId="00000000-0000-0000-0000-000000000001"
        checkIn="2027-01-10T03:00:00.000Z"
        checkOut="2027-01-10T06:00:00.000Z"
        adults={2}
        children={0}
      />,
    );
    expect(await screen.findByText(/Không thể tìm khung giờ thay thế/i)).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...SAMPLE_RESPONSE, recommendations: [] }));
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText(/Không có khung giờ nào rẻ hơn/i)).toBeInTheDocument();
    rerender(<div />);
  });
});
