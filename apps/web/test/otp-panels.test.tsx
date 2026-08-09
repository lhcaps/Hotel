import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OtpRequestPanel } from '../src/components/otp-request-panel';
import { OtpVerifyPanel } from '../src/components/otp-verify-panel';
import { LocaleProvider } from '../src/components/locale-provider';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OtpRequestPanel', () => {
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

  it('renders English request labels and safe validation', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider locale="en">
        <OtpRequestPanel onOtpRequested={vi.fn()} />
      </LocaleProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(
      await screen.findByText(
        'Enter a valid booking code using uppercase letters, digits, and hyphens.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Booking code')).toBeInTheDocument();
  });

  it('disables server-rendered request controls until React owns submission', () => {
    const document = new DOMParser().parseFromString(
      renderToString(<OtpRequestPanel onOtpRequested={vi.fn()} />),
      'text/html',
    );

    expect(document.querySelector('input[name="bookingCode"]')?.hasAttribute('disabled')).toBe(
      true,
    );
    expect(document.querySelector('input[name="email"]')?.hasAttribute('disabled')).toBe(true);
    expect(document.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('posts bookingCode/email to the otp/request route', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        challengeRef: 'A'.repeat(32),
        expiresAt: '2027-01-10T03:10:00.000Z',
        cooldownSeconds: 30,
        serverTime: '2027-01-10T03:00:00.000Z',
      }),
    );
    const onOtpRequested = vi.fn();
    const user = userEvent.setup();
    render(<OtpRequestPanel onOtpRequested={onOtpRequested} />);

    await user.type(screen.getByLabelText('Mã đặt phòng'), 'rm-ab23-cd45-ef67');
    await user.type(screen.getByLabelText('Email'), 'guest@example.test');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác nhận' }));

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://api.local/api/v1/public/guest-access/otp/request',
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      bookingCode: 'RM-AB23-CD45-EF67',
      email: 'guest@example.test',
    });
    expect(onOtpRequested).toHaveBeenCalledTimes(1);
  });

  it('renders the enumeration-resistant generic wording', async () => {
    render(<OtpRequestPanel onOtpRequested={vi.fn()} />);
    expect(
      screen.getByText(/Nếu thông tin đặt phòng hợp lệ, mã xác nhận sẽ được gửi qua email/),
    ).toBeInTheDocument();
  });

  it('keeps challengeRef in memory only and writes nothing to storage', async () => {
    const setLocal = vi.spyOn(window.localStorage, 'setItem');
    const setSession = vi.spyOn(window.sessionStorage, 'setItem');
    render(<OtpRequestPanel onOtpRequested={vi.fn()} />);
    expect(setLocal).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
    expect(screen.queryByText(/challengeRef/i)).not.toBeInTheDocument();
  });

  it('disables the submit button while the cooldown is active', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        challengeRef: 'A'.repeat(32),
        expiresAt: '2027-01-10T03:10:00.000Z',
        cooldownSeconds: 60,
        serverTime: '2027-01-10T03:00:00.000Z',
      }),
    );
    const onOtpRequested = vi.fn();
    const user = userEvent.setup();
    render(<OtpRequestPanel onOtpRequested={onOtpRequested} />);
    await user.type(screen.getByLabelText('Mã đặt phòng'), 'RM-AB23-CD45-EF67');
    await user.type(screen.getByLabelText('Email'), 'guest@example.test');
    await user.click(screen.getByRole('button', { name: 'Gửi mã xác nhận' }));
    expect(await screen.findByText(/Vui lòng đợi 60 giây/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Gửi mã xác nhận' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('renders no accessibility violations', async () => {
    const { container } = render(<OtpRequestPanel onOtpRequested={vi.fn()} />);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});

describe('OtpVerifyPanel', () => {
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

  it('renders English verification labels and six-digit validation', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider locale="en">
        <OtpVerifyPanel challengeRef={'A'.repeat(32)} onVerified={vi.fn()} />
      </LocaleProvider>,
    );
    await user.type(screen.getByLabelText('Verification code'), '12345');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Enter exactly six digits.')).toBeInTheDocument();
  });

  it('requires exactly six digits before submitting', async () => {
    const onVerified = vi.fn();
    const user = userEvent.setup();
    render(<OtpVerifyPanel challengeRef={'A'.repeat(32)} onVerified={onVerified} />);
    await user.type(screen.getByLabelText('Mã xác nhận'), '12345');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/Vui lòng nhập mã gồm đúng 6 chữ số/)).toBeInTheDocument();
  });

  it('submits challengeRef + otp and surfaces a generic invalid/expired message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: 'about:blank',
          title: 'Bad',
          status: 401,
          code: 'OTP_INVALID',
          detail: 'Bad',
          requestId: 'req-9',
          errors: [],
        },
        { status: 401 },
      ),
    );
    const onVerified = vi.fn();
    const user = userEvent.setup();
    render(<OtpVerifyPanel challengeRef={'A'.repeat(32)} onVerified={onVerified} />);
    await user.type(screen.getByLabelText('Mã xác nhận'), '123456');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toEqual({
      challengeRef: 'A'.repeat(32),
      otp: '123456',
    });
    expect(await screen.findByText(/Mã xác nhận không đúng hoặc đã hết hạn/)).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('does not expect any token in the response payload', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        bookingCode: 'RM-AB23-CD45-EF67',
        expiresAt: '2027-01-10T03:30:00.000Z',
        issuedAt: '2027-01-10T03:00:00.000Z',
      }),
    );
    const onVerified = vi.fn();
    const user = userEvent.setup();
    render(<OtpVerifyPanel challengeRef={'A'.repeat(32)} onVerified={onVerified} />);
    await user.type(screen.getByLabelText('Mã xác nhận'), '123456');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText('Mã xác nhận')).toBeInTheDocument();
    expect(onVerified).toHaveBeenCalledTimes(1);
    const response = onVerified.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(response.token).toBeUndefined();
    expect(response.sessionToken).toBeUndefined();
  });

  it('never writes the OTP to storage or logs', () => {
    const setLocal = vi.spyOn(window.localStorage, 'setItem');
    const setSession = vi.spyOn(window.sessionStorage, 'setItem');
    render(<OtpVerifyPanel challengeRef={'A'.repeat(32)} onVerified={vi.fn()} />);
    expect(setLocal).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('renders no accessibility violations', async () => {
    const { container } = render(
      <OtpVerifyPanel challengeRef={'A'.repeat(32)} onVerified={vi.fn()} />,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
