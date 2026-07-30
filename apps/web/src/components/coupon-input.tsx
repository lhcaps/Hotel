'use client';

import { type ChangeEvent, type FormEvent, useId, useRef, useState } from 'react';

import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export interface CouponInputProps {
  /**
   * Currently applied coupon code, if any. `null` means no code has been
   * applied yet; the field is purely transient state and is never written
   * to URL, localStorage, or sessionStorage.
   */
  readonly appliedCode: string | null;
  /**
   * When non-null, indicates the request is in flight and the parent quote
   * should be treated as a previous snapshot.
   */
  readonly pending: boolean;
  /**
   * Last server-issued error message to display beneath the input. Cleared
   * automatically when the user edits the field.
   */
  readonly errorMessage: string | null;
  /**
   * Issue a new quote with the supplied (possibly empty) coupon code.
   * Returning a non-empty trimmed value is treated as the user-applied
   * code; an empty string clears the coupon and reissues a plain quote.
   */
  readonly onApply: (code: string) => Promise<void> | void;
  /**
   * Clear the current coupon and reissue a plain quote.
   */
  readonly onClear: () => Promise<void> | void;
}

function trimCode(value: string): string {
  return value.trim();
}

export function CouponInput({
  appliedCode,
  pending,
  errorMessage,
  onApply,
  onClear,
}: CouponInputProps) {
  const locale = useLocale();
  const formId = useId();
  const [draft, setDraft] = useState<string>(appliedCode ?? '');
  const inFlight = useRef(false);
  const codeId = `${formId}-code`;
  const errorId = `${formId}-error`;
  const helpId = `${formId}-help`;
  const successId = `${formId}-success`;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
  }

  async function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const trimmed = trimCode(draft);
    inFlight.current = true;
    try {
      await onApply(trimmed);
    } finally {
      inFlight.current = false;
    }
  }

  async function handleClear() {
    if (inFlight.current) return;
    inFlight.current = true;
    setDraft('');
    try {
      await onClear();
    } finally {
      inFlight.current = false;
    }
  }

  const showClear = (appliedCode ?? '').length > 0;

  return (
    <form
      aria-labelledby={`${formId}-heading`}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="coupon-input"
      data-pending={pending ? 'true' : 'false'}
      onSubmit={handleApply}
    >
      <h2 id={`${formId}-heading`} className="text-xl font-semibold">
        {translate(locale, 'coupon.inputHeading')}
      </h2>
      <p id={helpId} className="mt-2 text-sm text-slate-600">
        {translate(locale, 'coupon.help')}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={codeId} className="block text-sm font-medium">
            {translate(locale, 'coupon.label')}
          </label>
          <input
            aria-describedby={
              errorMessage !== null
                ? `${helpId} ${errorId}`
                : `${helpId}${appliedCode !== null ? ` ${successId}` : ''}`
            }
            aria-invalid={errorMessage !== null}
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono uppercase"
            disabled={pending}
            id={codeId}
            inputMode="text"
            maxLength={32}
            name="couponCode"
            onChange={handleChange}
            pattern="[A-Za-z0-9\\-]{4,32}"
            placeholder={translate(locale, 'coupon.placeholder')}
            spellCheck={false}
            value={draft}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            aria-busy={pending}
            className="rounded-md bg-sky-700 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? translate(locale, 'coupon.applying') : translate(locale, 'coupon.apply')}
          </button>
          {showClear ? (
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 disabled:opacity-60"
              data-testid="coupon-clear"
              disabled={pending}
              onClick={() => {
                void handleClear();
              }}
              type="button"
            >
              {translate(locale, 'coupon.clear')}
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage !== null ? (
        <p
          className="mt-3 text-sm text-red-600"
          data-testid="coupon-error"
          id={errorId}
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {appliedCode !== null && errorMessage === null ? (
        <p
          aria-live="polite"
          className="mt-3 text-sm text-emerald-700"
          data-testid="coupon-applied"
          id={successId}
        >
          {translate(locale, 'coupon.applied', { code: appliedCode })}
        </p>
      ) : null}
    </form>
  );
}
