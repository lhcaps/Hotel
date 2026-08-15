'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { fromProblemDetails, pickFieldError } from '../lib/form-error';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AdminPageHeader } from './admin/admin-ui';
export function CouponForm() {
  const locale = useLocale();
  const [type, setType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [roomTypes, setRoomTypes] = useState<readonly { id: string; name: string }[]>([]);
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    void adminApi
      .listRoomTypes()
      .then((result) => setRoomTypes(result.items))
      .catch(() => setError(translate(locale, 'coupon.roomTypesLoadError')));
  }, [locale]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const raw = {
      code: String(data.get('code') ?? ''),
      discountType: type,
      ...(type === 'FIXED'
        ? { fixedAmountVnd: Number(data.get('fixedAmountVnd')) }
        : {
            percentageBasisPoints: Number(data.get('percentageBasisPoints')),
            maximumDiscountVnd: data.get('maximumDiscountVnd')
              ? Number(data.get('maximumDiscountVnd'))
              : null,
          }),
      minimumOrderAmountVnd: Number(data.get('minimumOrderAmountVnd') || 0),
      validFrom: new Date(String(data.get('validFrom'))).toISOString(),
      validUntil: new Date(String(data.get('validUntil'))).toISOString(),
      roomTypes: all ? { all: true } : { roomTypeIds: selected },
      totalUsageLimit: data.get('totalUsageLimit') ? Number(data.get('totalUsageLimit')) : null,
      perCustomerLimit: data.get('perCustomerLimit') ? Number(data.get('perCustomerLimit')) : null,
    };
    const valid =
      Number(data.get('minimumOrderAmountVnd') ?? 0) >= 0 &&
      new Date(String(data.get('validUntil'))).getTime() >
        new Date(String(data.get('validFrom'))).getTime() &&
      String(data.get('code') ?? '').length >= 4 &&
      (all || selected.length > 0) &&
      (type === 'FIXED'
        ? Number(data.get('fixedAmountVnd')) > 0
        : Number(data.get('percentageBasisPoints')) > 0 &&
          Number(data.get('percentageBasisPoints')) <= 10000);
    if (!valid) {
      setError(translate(locale, 'coupon.validationError'));
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const coupon = await adminApi.createCoupon(raw);
      globalThis.location.href = `/admin/coupons/${coupon.id}`;
    } catch (reason) {
      if (reason instanceof AdminApiError) {
        const problemState = fromProblemDetails(reason.problem);
        const fieldError =
          pickFieldError(problemState, 'code') ??
          pickFieldError(problemState, 'fixedAmountVnd') ??
          pickFieldError(problemState, 'percentageBasisPoints') ??
          pickFieldError(problemState, 'validFrom') ??
          pickFieldError(problemState, 'validUntil');
        if (fieldError !== undefined) {
          setError(fieldError);
          return;
        }
      }
      setError(
        reason instanceof AdminApiError && reason.problem.status === 409
          ? translate(locale, 'coupon.duplicateCode')
          : translate(locale, 'coupon.createError'),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="admin-page">
      <Link href="/admin/coupons">← {translate(locale, 'coupon.backToList')}</Link>
      <AdminPageHeader
        title={translate(locale, 'coupon.createHeading')}
        description={translate(locale, 'coupon.roomTypeScope')}
      />
      {error && <p role="alert">{error}</p>}
      <form className="coupon-form" onSubmit={(event) => void submit(event)}>
        <label>
          {translate(locale, 'coupon.code')}
          <Input name="code" required minLength={4} maxLength={32} />
        </label>
        <fieldset>
          <legend>{translate(locale, 'coupon.discountType')}</legend>
          <label>
            <input type="radio" checked={type === 'FIXED'} onChange={() => setType('FIXED')} />{' '}
            FIXED
          </label>
          <label>
            <input
              type="radio"
              checked={type === 'PERCENTAGE'}
              onChange={() => setType('PERCENTAGE')}
            />{' '}
            PERCENTAGE
          </label>
        </fieldset>
        {type === 'FIXED' ? (
          <label>
            {translate(locale, 'coupon.fixedAmount')}
            <Input name="fixedAmountVnd" type="number" min="1" required />
          </label>
        ) : (
          <>
            <label>
              {translate(locale, 'coupon.percentageBasisPoints')}
              <Input name="percentageBasisPoints" type="number" min="1" max="10000" required />
              <small>{translate(locale, 'coupon.basisPointHelp')}</small>
            </label>
            <label>
              {translate(locale, 'coupon.maximumDiscount')}
              <Input name="maximumDiscountVnd" type="number" min="1" />
            </label>
          </>
        )}
        <label>
          {translate(locale, 'coupon.minimumOrder')}
          <Input name="minimumOrderAmountVnd" type="number" min="0" defaultValue="0" />
        </label>
        <label>
          {translate(locale, 'coupon.validFrom')}
          <Input name="validFrom" type="datetime-local" required />
        </label>
        <label>
          {translate(locale, 'coupon.validUntil')}
          <Input name="validUntil" type="datetime-local" required />
        </label>
        <fieldset>
          <legend>{translate(locale, 'coupon.roomTypeScope')}</legend>
          <label>
            <input
              className="admin-checkbox-input"
              checked={all}
              onChange={(event) => setAll(event.target.checked)}
              type="checkbox"
            />{' '}
            {translate(locale, 'coupon.allRoomTypes')}
          </label>
          {!all &&
            roomTypes.map((room) => (
              <label key={room.id}>
                <input
                  className="admin-checkbox-input"
                  checked={selected.includes(room.id)}
                  type="checkbox"
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, room.id]
                        : selected.filter((id) => id !== room.id),
                    )
                  }
                />{' '}
                {room.name}
              </label>
            ))}
        </fieldset>
        <label>
          {translate(locale, 'coupon.totalUsageLimit')}
          <Input name="totalUsageLimit" type="number" min="1" />
        </label>
        <label>
          {translate(locale, 'coupon.perCustomerLimit')}
          <Input name="perCustomerLimit" type="number" min="1" />
        </label>
        <Button disabled={pending} type="submit">
          {pending ? translate(locale, 'coupon.createPending') : translate(locale, 'coupon.create')}
        </Button>
      </form>
    </section>
  );
}
