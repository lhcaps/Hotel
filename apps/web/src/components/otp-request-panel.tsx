'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import type { GuestAccessOtpRequestResponse } from '@room/contracts';

import { bookingApi, BookingApiError } from '../lib/booking-api';
import { translate, type Locale } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export interface OtpRequestPanelProps {
  readonly onOtpRequested: (
    response: GuestAccessOtpRequestResponse,
    submitted: { readonly bookingCode: string; readonly email: string },
  ) => void;
}

const BOOKING_CODE_PATTERN = /^[A-Z0-9-]{8,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  readonly bookingCode?: string;
  readonly email?: string;
};

function validate(locale: Locale, values: { bookingCode: string; email: string }): FieldErrors {
  const errors: { bookingCode?: string; email?: string } = {};
  if (!BOOKING_CODE_PATTERN.test(values.bookingCode.trim().toUpperCase())) {
    errors.bookingCode = translate(locale, 'otp.bookingCodeInvalid');
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = translate(locale, 'otp.emailInvalid');
  }
  return errors;
}

function problemToMessage(locale: Locale, error: unknown): string {
  if (error instanceof BookingApiError) {
    if (error.status === 429) {
      return translate(locale, 'otp.rateLimited');
    }
    if (error.status >= 500) {
      return translate(locale, 'otp.unavailable');
    }
    return error.message;
  }
  return translate(locale, 'otp.requestError');
}

export function OtpRequestPanel({ onOtpRequested }: OtpRequestPanelProps) {
  const locale = useLocale();
  const formId = useId();
  const [bookingCode, setBookingCode] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const codeId = `${formId}-booking-code`;
  const emailId = `${formId}-email`;
  const codeErrorId = `${formId}-code-error`;
  const emailErrorId = `${formId}-email-error`;
  const submitErrorId = `${formId}-submit-error`;
  const cooldownId = `${formId}-cooldown`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setSubmitError(undefined);
    const values = {
      bookingCode: bookingCode.trim().toUpperCase(),
      email: email.trim().toLowerCase(),
    };
    const validation = validate(locale, values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    inFlight.current = true;
    setPending(true);
    try {
      const response = await bookingApi.requestGuestOtp({
        bookingCode: values.bookingCode,
        email: values.email,
      });
      setCooldownSeconds(response.cooldownSeconds);
      onOtpRequested(response, { bookingCode: values.bookingCode, email: values.email });
    } catch (error) {
      setSubmitError(problemToMessage(locale, error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const controlsDisabled = !isHydrated || pending;
  const cooldownBlocked = controlsDisabled || cooldownSeconds > 0;

  return (
    <form
      aria-labelledby={`${formId}-heading`}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      noValidate
      onSubmit={onSubmit}
    >
      <h2 id={`${formId}-heading`} className="text-xl font-semibold">
        {translate(locale, 'otp.requestHeading')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{translate(locale, 'otp.requestHelp')}</p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor={codeId} className="block text-sm font-medium">
            {translate(locale, 'otp.bookingCode')}
          </label>
          <input
            id={codeId}
            aria-describedby={errors.bookingCode !== undefined ? codeErrorId : undefined}
            aria-invalid={errors.bookingCode !== undefined}
            autoCapitalize="characters"
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono tracking-wide"
            disabled={controlsDisabled}
            maxLength={32}
            name="bookingCode"
            onChange={(event) => setBookingCode(event.target.value)}
            required
            type="text"
            value={bookingCode}
          />
          {errors.bookingCode !== undefined ? (
            <p id={codeErrorId} className="mt-1 text-sm text-red-600" role="alert">
              {errors.bookingCode}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={emailId} className="block text-sm font-medium">
            Email
          </label>
          <input
            id={emailId}
            aria-describedby={errors.email !== undefined ? emailErrorId : undefined}
            aria-invalid={errors.email !== undefined}
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            disabled={controlsDisabled}
            inputMode="email"
            maxLength={254}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          {errors.email !== undefined ? (
            <p id={emailErrorId} className="mt-1 text-sm text-red-600" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>

      {submitError !== undefined ? (
        <p id={submitErrorId} className="mt-4 text-sm text-red-600" role="alert">
          {submitError}
        </p>
      ) : null}

      <button
        aria-busy={pending}
        aria-describedby={cooldownSeconds > 0 ? cooldownId : undefined}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-sky-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={cooldownBlocked}
        type="submit"
      >
        {pending ? translate(locale, 'otp.sending') : translate(locale, 'otp.send')}
      </button>

      {cooldownSeconds > 0 ? (
        <p id={cooldownId} className="mt-2 text-sm text-slate-600">
          {translate(locale, 'otp.cooldown', { seconds: cooldownSeconds })}
        </p>
      ) : null}
    </form>
  );
}
