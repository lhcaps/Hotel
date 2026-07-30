'use client';

import { type FormEvent, useId, useRef, useState } from 'react';
import type { GuestAccessOtpVerifyResponse } from '@room/contracts';

import { bookingApi, BookingApiError } from '../lib/booking-api';
import { translate, type Locale } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export interface OtpVerifyPanelProps {
  readonly challengeRef: string;
  readonly onVerified: (response: GuestAccessOtpVerifyResponse) => void;
}

const OTP_PATTERN = /^[0-9]{6}$/;

function problemToMessage(locale: Locale, error: unknown): string {
  if (error instanceof BookingApiError) {
    if (error.status >= 500) {
      return translate(locale, 'otp.unavailable');
    }
    return translate(locale, 'otp.invalidOrExpired');
  }
  return translate(locale, 'otp.verifyError');
}

export function OtpVerifyPanel({ challengeRef, onVerified }: OtpVerifyPanelProps) {
  const locale = useLocale();
  const formId = useId();
  const [otp, setOtp] = useState('');
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const otpId = `${formId}-otp`;
  const otpErrorId = `${formId}-otp-error`;
  const submitErrorId = `${formId}-submit-error`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setSubmitError(undefined);
    const trimmed = otp.trim();
    if (!OTP_PATTERN.test(trimmed)) {
      setSubmitError(translate(locale, 'otp.codeInvalid'));
      return;
    }

    inFlight.current = true;
    setPending(true);
    try {
      const response = await bookingApi.verifyGuestOtp({ challengeRef, otp: trimmed });
      onVerified(response);
    } catch (error) {
      setSubmitError(problemToMessage(locale, error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form
      aria-labelledby={`${formId}-heading`}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      noValidate
      onSubmit={onSubmit}
    >
      <h2 id={`${formId}-heading`} className="text-xl font-semibold">
        {translate(locale, 'otp.verifyHeading')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{translate(locale, 'otp.verifyHelp')}</p>

      <div className="mt-4">
        <label htmlFor={otpId} className="block text-sm font-medium">
          {translate(locale, 'otp.code')}
        </label>
        <input
          id={otpId}
          aria-describedby={submitError !== undefined ? submitErrorId : undefined}
          autoComplete="one-time-code"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-lg tracking-[0.4em]"
          disabled={pending}
          inputMode="numeric"
          maxLength={6}
          name="otp"
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, 6);
            setOtp(next);
          }}
          pattern="[0-9]{6}"
          required
          type="text"
          value={otp}
        />
        {submitError !== undefined ? (
          <p id={submitErrorId} className="mt-1 text-sm text-red-600" role="alert">
            {submitError}
          </p>
        ) : (
          <p id={otpErrorId} className="mt-1 text-xs text-slate-500">
            {translate(locale, 'otp.codeHint')}
          </p>
        )}
      </div>

      <button
        aria-busy={pending}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-sky-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? translate(locale, 'otp.verifying') : translate(locale, 'otp.verify')}
      </button>
    </form>
  );
}
