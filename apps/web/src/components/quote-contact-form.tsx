'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import type { BookingHoldResponse, Quote } from '@room/contracts';

import {
  bookingApi,
  BookingApiError,
  type PaymentInitiationResponse,
  type PublicPaymentProvider,
} from '../lib/booking-api';
import { assertSafePaymentRedirect, type PaymentRedirectRuntime } from '../lib/payment-redirect';
import { translate, type Locale } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export interface QuoteContactFormProps {
  readonly quote: Quote;
  readonly onHoldCreated?: (hold: BookingHoldResponse, email: string) => void;
  readonly onCheckoutStarted?: (checkout: CheckoutStarted) => void;
}

type PaymentProvider = 'MOMO' | 'VNPAY';

type CheckoutStarted = Readonly<{
  bookingCode: string;
  payment: PaymentInitiationResponse;
}>;

const PHONE_PATTERN = /^(?:\+[1-9]\d{7,14}|0(?:3|5|7|8|9)\d{8})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^.{1,160}$/;

function normalizeBookingPhoneInput(value: string): string {
  const trimmed = value.trim();
  return /^0(?:3|5|7|8|9)\d{8}$/.test(trimmed) ? `+84${trimmed.slice(1)}` : trimmed;
}

type FieldErrors = {
  readonly fullName?: string;
  readonly email?: string;
  readonly phone?: string;
};

function validate(
  locale: Locale,
  values: { fullName: string; email: string; phone: string },
): FieldErrors {
  const errors: { fullName?: string; email?: string; phone?: string } = {};
  if (!NAME_PATTERN.test(values.fullName.trim())) {
    errors.fullName = translate(locale, 'hold.fullNameInvalid');
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = translate(locale, 'hold.emailInvalid');
  }
  if (!PHONE_PATTERN.test(values.phone.trim())) {
    errors.phone = translate(locale, 'hold.phoneInvalid');
  }
  return errors;
}

const PAYMENT_RUNTIME: PaymentRedirectRuntime =
  process.env['NEXT_PUBLIC_PAYMENT_REDIRECT_RUNTIME'] === 'production'
    ? 'production'
    : process.env['NEXT_PUBLIC_PAYMENT_REDIRECT_RUNTIME'] === 'test'
      ? 'test'
      : 'development';

function problemToMessage(
  locale: Locale,
  error: unknown,
  phase: 'payment' | 'reservation',
): string {
  if (phase === 'payment') return translate(locale, 'payment.initError');
  if (error instanceof BookingApiError) {
    if (error.status === 429) {
      return translate(locale, 'hold.rateLimited');
    }
    if (error.status === 410) {
      return translate(locale, 'hold.quoteExpired');
    }
    if (error.status >= 500) {
      return translate(locale, 'hold.unavailable');
    }
    if (error.code === 'COUPON_REQUOTE_REQUIRED') {
      return translate(locale, 'hold.couponRequote');
    }
    if (error.code === 'COUPON_HOLD_WINDOW_INCOMPATIBLE') {
      return translate(locale, 'hold.couponWindow');
    }
    if (error.code === 'COUPON_MINIMUM_NOT_MET') {
      return translate(locale, 'hold.couponMinimum');
    }
    if (error.code === 'COUPON_LIMIT_REACHED') {
      return translate(locale, 'hold.couponLimit');
    }
    if (error.code === 'COUPON_CUSTOMER_LIMIT_REACHED') {
      return translate(locale, 'hold.couponCustomerLimit');
    }
    if (error.code === 'COUPON_EXPIRED') {
      return translate(locale, 'hold.couponExpired');
    }
    return error.message;
  }
  return translate(locale, 'hold.genericError');
}

export function QuoteContactForm({
  quote,
  onHoldCreated,
  onCheckoutStarted,
}: QuoteContactFormProps) {
  const locale = useLocale();
  const formId = useId();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+84');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [providers, setProviders] = useState<readonly PublicPaymentProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | undefined>();
  const [providersLoaded, setProvidersLoaded] = useState(onCheckoutStarted === undefined);
  const inFlight = useRef(false);
  const checkoutMode = onCheckoutStarted !== undefined;

  const nameId = `${formId}-full-name`;
  const emailId = `${formId}-email`;
  const phoneId = `${formId}-phone`;
  const nameErrorId = `${formId}-full-name-error`;
  const emailErrorId = `${formId}-email-error`;
  const phoneErrorId = `${formId}-phone-error`;
  const submitErrorId = `${formId}-submit-error`;

  useEffect(() => {
    if (!checkoutMode) return;
    let cancelled = false;
    void bookingApi
      .listPaymentProviders()
      .then((response) => {
        if (cancelled) return;
        setProviders(response);
        setProvidersLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProviders([]);
        setProvidersLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutMode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setSubmitError(undefined);
    const values = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: normalizeBookingPhoneInput(phone),
    };
    const validation = validate(locale, values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    if (checkoutMode && selectedProvider === undefined) {
      setSubmitError(translate(locale, 'payment.providerRequired'));
      return;
    }

    inFlight.current = true;
    setPending(true);
    let phase: 'payment' | 'reservation' = 'reservation';
    try {
      const response = await bookingApi.createBookingHold(quote.id, {
        contact: {
          fullName: values.fullName,
          email: values.email.toLowerCase(),
          phone: values.phone,
        },
      });
      if (!checkoutMode) {
        onHoldCreated?.(response, values.email.toLowerCase());
        return;
      }
      if (selectedProvider === undefined) {
        setSubmitError(translate(locale, 'payment.providerRequired'));
        return;
      }
      phase = 'payment';
      const payment = await bookingApi.initiatePayment(
        response.bookingCode,
        selectedProvider,
        globalThis.crypto.randomUUID(),
      );
      assertSafePaymentRedirect(payment.redirectUrl, PAYMENT_RUNTIME);
      onCheckoutStarted({ bookingCode: response.bookingCode, payment });
    } catch (error) {
      setSubmitError(problemToMessage(locale, error, phase));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form
      aria-labelledby={`${formId}-heading`}
      className="quote-contact-form"
      noValidate
      onSubmit={onSubmit}
    >
      <h2 id={`${formId}-heading`} className="text-xl font-semibold">
        {translate(locale, 'hold.contactHeading')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {translate(locale, checkoutMode ? 'payment.contactHelp' : 'hold.contactHelp')}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor={nameId} className="block text-sm font-medium">
            {translate(locale, 'hold.fullName')}
          </label>
          <input
            id={nameId}
            aria-describedby={errors.fullName !== undefined ? nameErrorId : undefined}
            aria-invalid={errors.fullName !== undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            disabled={pending}
            maxLength={160}
            name="fullName"
            onChange={(event) => setFullName(event.target.value)}
            required
            type="text"
            value={fullName}
          />
          {errors.fullName !== undefined ? (
            <p id={nameErrorId} className="mt-1 text-sm text-red-600" role="alert">
              {errors.fullName}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={emailId} className="block text-sm font-medium">
            {translate(locale, 'hold.email')}
          </label>
          <input
            id={emailId}
            aria-describedby={errors.email !== undefined ? emailErrorId : undefined}
            aria-invalid={errors.email !== undefined}
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            disabled={pending}
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

        <div>
          <label htmlFor={phoneId} className="block text-sm font-medium">
            {translate(locale, 'hold.phone')}
          </label>
          <input
            id={phoneId}
            aria-label={translate(locale, 'hold.phoneAccessibleLabel')}
            aria-describedby={errors.phone !== undefined ? phoneErrorId : `${phoneId}-hint`}
            aria-invalid={errors.phone !== undefined}
            autoComplete="tel"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            disabled={pending}
            inputMode="tel"
            maxLength={20}
            name="phone"
            onChange={(event) => setPhone(event.target.value)}
            required
            type="tel"
            value={phone}
          />
          <p id={`${phoneId}-hint`} className="mt-1 text-xs text-slate-500">
            {translate(locale, 'hold.phoneHint')}
          </p>
          {errors.phone !== undefined ? (
            <p id={phoneErrorId} className="mt-1 text-sm text-red-600" role="alert">
              {errors.phone}
            </p>
          ) : null}
        </div>
      </div>

      {checkoutMode ? (
        <fieldset className="mt-6 space-y-3" disabled={pending || !providersLoaded}>
          <legend className="font-semibold">{translate(locale, 'payment.selection')}</legend>
          <p className="text-sm text-slate-600">{translate(locale, 'payment.selectionHelp')}</p>
          {providers.map((provider) => (
            <label
              className="flex items-center gap-2 rounded-md border p-3"
              key={provider.provider}
            >
              <input
                checked={selectedProvider === provider.provider}
                disabled={!provider.enabled}
                name={`${formId}-payment-provider`}
                onChange={() => setSelectedProvider(provider.provider)}
                type="radio"
                value={provider.provider}
              />
              <span>{provider.displayName}</span>
              {!provider.enabled ? (
                <span className="text-sm text-slate-600">
                  {provider.maintenanceMessage ?? translate(locale, 'payment.providerUnavailable')}
                </span>
              ) : null}
            </label>
          ))}
          {providersLoaded && providers.length === 0 ? (
            <p className="text-sm text-red-700" role="alert">
              {translate(locale, 'payment.noProviders')}
            </p>
          ) : null}
          <p className="text-sm font-medium text-emerald-800">
            {translate(locale, 'payment.demoNotice')}
          </p>
        </fieldset>
      ) : null}

      {submitError !== undefined ? (
        <p id={submitErrorId} className="mt-4 text-sm text-red-600" role="alert">
          {submitError}
        </p>
      ) : null}

      <button
        aria-busy={pending}
        className="hospitality-button mt-6 inline-flex items-center justify-center px-4 py-2 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending
          ? translate(locale, checkoutMode ? 'payment.checkoutPending' : 'hold.pending')
          : translate(locale, checkoutMode ? 'payment.checkoutSubmit' : 'hold.submit')}
      </button>
    </form>
  );
}
