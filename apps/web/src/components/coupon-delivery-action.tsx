'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function CouponDeliveryAction({ bookingCode }: { readonly bookingCode: string }) {
  const locale = useLocale();
  const [availableCodes, setAvailableCodes] = useState<readonly string[]>();
  const [selectedCodes, setSelectedCodes] = useState<readonly string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void adminApi
      .listCoupons()
      .then(({ items }) =>
        setAvailableCodes(
          items.filter((coupon) => coupon.lifecycle === 'AVAILABLE').map((coupon) => coupon.code),
        ),
      )
      .catch((cause: unknown) => {
        setStatus(
          cause instanceof AdminApiError ? translate(locale, 'admin.couponsLoadError') : translate(locale, 'admin.couponsLoadError'),
        );
      });
  }, [locale]);

  const hasSelection = selectedCodes.length > 0;
  const selectedLabel = useMemo(() => selectedCodes.join(', '), [selectedCodes]);

  function toggleCoupon(code: string) {
    setSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
    setConfirmed(false);
    setStatus(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasSelection || !confirmed) return;

    setPending(true);
    setStatus(undefined);
    try {
      await adminApi.sendAdminBookingCoupons(bookingCode, selectedCodes, crypto.randomUUID());
      setStatus(
        translate(locale, 'admin.couponQueued'),
      );
      setSelectedCodes([]);
      setConfirmed(false);
    } catch (cause: unknown) {
      setStatus(
        cause instanceof AdminApiError ? translate(locale, 'admin.couponQueueError') : translate(locale, 'admin.couponQueueError'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="coupon-delivery-heading">
      <h2 id="coupon-delivery-heading">{translate(locale, 'admin.couponDeliveryHeading')}</h2>
      <p>{translate(locale, 'admin.couponDeliveryHelp')}</p>
      {status === undefined ? null : (
        <p aria-live="polite" role="status">
          {status}
        </p>
      )}
      {availableCodes === undefined ? (
        <p aria-live="polite">{translate(locale, 'admin.loadingCoupons')}</p>
      ) : availableCodes.length === 0 ? (
        <p>{translate(locale, 'admin.noCouponsAvailable')}</p>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={pending}>
            <legend>{translate(locale, 'admin.selectCoupons')}</legend>
            {availableCodes.map((code) => (
              <label key={code}>
                <input
                  checked={selectedCodes.includes(code)}
                  onChange={() => toggleCoupon(code)}
                  type="checkbox"
                />
                {code}
              </label>
            ))}
          </fieldset>
          {hasSelection ? (
            <label>
              <input
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                type="checkbox"
              />
              {translate(locale, 'admin.confirmCouponDelivery', { codes: selectedLabel })}
            </label>
          ) : null}
          <button disabled={!hasSelection || !confirmed || pending} type="submit">
            {pending ? translate(locale, 'admin.queueing') : translate(locale, 'admin.queueCouponDelivery')}
          </button>
        </form>
      )}
    </section>
  );
}
