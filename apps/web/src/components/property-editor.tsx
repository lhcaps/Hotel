'use client';

import { type FormEvent, useEffect, useState } from 'react';

import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Alert, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field, FieldError, FieldGroup, FieldLabel } from './ui/field';
import { AdminFormSection, AdminLoadingState, AdminPageHeader } from './admin/admin-ui';
import { PropertyArrivalAccessEditor } from './arrival-access-config-editors';

export function PropertyEditor() {
  const locale = useLocale();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [minimumStayMinutes, setMinimumStayMinutes] = useState(60);
  const [maximumStayMinutes, setMaximumStayMinutes] = useState(10080);
  const [minimumLeadTimeMinutes, setMinimumLeadTimeMinutes] = useState(0);
  const [maximumAdvanceBookingDays, setMaximumAdvanceBookingDays] = useState(365);
  const [defaultOvernightDurationMinutes, setDefaultOvernightDurationMinutes] = useState(720);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [stayRangeError, setStayRangeError] = useState<string>();

  useEffect(() => {
    let active = true;
    void adminApi
      .property()
      .then((property) => {
        if (!active) return;
        setCode(property.code);
        setName(property.name);
        setMinimumStayMinutes(property.minimumStayMinutes ?? 60);
        setMaximumStayMinutes(property.maximumStayMinutes ?? 10080);
        setMinimumLeadTimeMinutes(property.minimumLeadTimeMinutes ?? 0);
        setMaximumAdvanceBookingDays(property.maximumAdvanceBookingDays ?? 365);
        setDefaultOvernightDurationMinutes(property.defaultOvernightDurationMinutes ?? 720);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setMessage(
          cause instanceof AdminApiError
            ? translate(locale, 'property.loadError')
            : translate(locale, 'property.loadError'),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (minimumStayMinutes > maximumStayMinutes) {
      setStayRangeError(translate(locale, 'property.invalidStayRange'));
      return;
    }
    setStayRangeError(undefined);
    setPending(true);
    setMessage(undefined);
    try {
      const property = await adminApi.updateProperty({
        code,
        name,
        minimumStayMinutes,
        maximumStayMinutes,
        minimumLeadTimeMinutes,
        maximumAdvanceBookingDays,
        defaultOvernightDurationMinutes,
      });
      setCode(property.code);
      setName(property.name);
      setMinimumStayMinutes(property.minimumStayMinutes ?? minimumStayMinutes);
      setMaximumStayMinutes(property.maximumStayMinutes ?? maximumStayMinutes);
      setMinimumLeadTimeMinutes(property.minimumLeadTimeMinutes ?? minimumLeadTimeMinutes);
      setMaximumAdvanceBookingDays(property.maximumAdvanceBookingDays ?? maximumAdvanceBookingDays);
      setDefaultOvernightDurationMinutes(
        property.defaultOvernightDurationMinutes ?? defaultOvernightDurationMinutes,
      );
      setMessage(translate(locale, 'property.saved'));
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError
          ? translate(locale, 'property.saveError')
          : translate(locale, 'property.saveError'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.property')}
        description={translate(locale, 'property.help')}
      />
      {loading ? <AdminLoadingState label={translate(locale, 'admin.loadingData')} /> : null}
      <form className="admin-form-stack admin-property-form" onSubmit={save}>
        <AdminFormSection title={translate(locale, 'property.identityHeading')}>
          <Field>
            <FieldLabel htmlFor="property-code">{translate(locale, 'property.code')}</FieldLabel>
            <Input
              id="property-code"
              disabled={loading || pending}
              onChange={(event) => setCode(event.target.value)}
              value={code}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="property-name">{translate(locale, 'property.name')}</FieldLabel>
            <Input
              id="property-name"
              disabled={loading || pending}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
        </AdminFormSection>
        <AdminFormSection title={translate(locale, 'property.stayRulesHeading')}>
          <Field data-invalid={stayRangeError !== undefined}>
            <FieldLabel htmlFor="property-min-stay">
              {translate(locale, 'property.minimumStayMinutes')}
            </FieldLabel>
            <Input
              id="property-min-stay"
              aria-invalid={stayRangeError !== undefined}
              disabled={loading || pending}
              min={1}
              onChange={(event) => setMinimumStayMinutes(Number(event.target.value))}
              type="number"
              value={minimumStayMinutes}
            />
          </Field>
          <Field data-invalid={stayRangeError !== undefined}>
            <FieldLabel htmlFor="property-max-stay">
              {translate(locale, 'property.maximumStayMinutes')}
            </FieldLabel>
            <Input
              id="property-max-stay"
              aria-invalid={stayRangeError !== undefined}
              disabled={loading || pending}
              min={1}
              onChange={(event) => setMaximumStayMinutes(Number(event.target.value))}
              type="number"
              value={maximumStayMinutes}
            />
            <FieldError>{stayRangeError}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="property-overnight">
              {translate(locale, 'property.defaultOvernightDurationMinutes')}
            </FieldLabel>
            <Input
              id="property-overnight"
              disabled={loading || pending}
              min={1}
              onChange={(event) => setDefaultOvernightDurationMinutes(Number(event.target.value))}
              type="number"
              value={defaultOvernightDurationMinutes}
            />
          </Field>
        </AdminFormSection>
        <AdminFormSection title={translate(locale, 'property.bookingWindowHeading')}>
          <Field>
            <FieldLabel htmlFor="property-min-lead">
              {translate(locale, 'property.minimumLeadTimeMinutes')}
            </FieldLabel>
            <Input
              id="property-min-lead"
              disabled={loading || pending}
              min={0}
              onChange={(event) => setMinimumLeadTimeMinutes(Number(event.target.value))}
              type="number"
              value={minimumLeadTimeMinutes}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="property-max-advance">
              {translate(locale, 'property.maximumAdvanceBookingDays')}
            </FieldLabel>
            <Input
              id="property-max-advance"
              disabled={loading || pending}
              min={0}
              onChange={(event) => setMaximumAdvanceBookingDays(Number(event.target.value))}
              type="number"
              value={maximumAdvanceBookingDays}
            />
          </Field>
        </AdminFormSection>
        <FieldGroup>
          <Button disabled={loading || pending} type="submit">
            {pending ? translate(locale, 'profile.saving') : translate(locale, 'property.save')}
          </Button>
        </FieldGroup>
      </form>
      {message === undefined ? null : (
        <Alert>
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      )}
      <PropertyArrivalAccessEditor />
    </section>
  );
}
