'use client';

import { type FormEvent, useEffect, useState } from 'react';

import { publicContactSchema, type PublicContact } from '@room/contracts';

import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import {
  fromProblemDetails,
  fromUnknownError,
  pickFieldError,
  type FieldErrorState,
} from '../lib/form-error';
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
  const [propertyId, setPropertyId] = useState<string>();
  const [contact, setContact] = useState<PublicContact>({});
  const [contactPending, setContactPending] = useState(false);
  const [contactErrors, setContactErrors] = useState<FieldErrorState>({ fieldErrors: {} });
  const [contactMessage, setContactMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void adminApi
      .property()
      .then(async (property) => {
        if (!active) return;
        setPropertyId(property.id);
        setCode(property.code);
        setName(property.name);
        setMinimumStayMinutes(property.minimumStayMinutes ?? 60);
        setMaximumStayMinutes(property.maximumStayMinutes ?? 10080);
        setMinimumLeadTimeMinutes(property.minimumLeadTimeMinutes ?? 0);
        setMaximumAdvanceBookingDays(property.maximumAdvanceBookingDays ?? 365);
        setDefaultOvernightDurationMinutes(property.defaultOvernightDurationMinutes ?? 720);
        try {
          const fetched = await fetch(
            `/api/v1/public/properties/${encodeURIComponent(property.code)}/contact`,
            { cache: 'no-store' },
          );
          if (fetched.ok) {
            const body = (await fetched.json()) as PublicContact;
            setContact(body);
          }
        } catch {
          // best-effort; form stays blank
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setMessage(translate(locale, 'property.loadError'));
        if (cause instanceof AdminApiError) {
          setMessage(translate(locale, 'property.loadError'));
        }
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
      if (cause instanceof AdminApiError) {
        const problemState = fromProblemDetails(cause.problem);
        const fieldError =
          pickFieldError(problemState, 'code') ??
          pickFieldError(problemState, 'name') ??
          pickFieldError(problemState, 'minimumStayMinutes') ??
          pickFieldError(problemState, 'maximumStayMinutes') ??
          pickFieldError(problemState, 'minimumLeadTimeMinutes') ??
          pickFieldError(problemState, 'maximumAdvanceBookingDays') ??
          pickFieldError(problemState, 'defaultOvernightDurationMinutes');
        if (fieldError !== undefined) {
          setMessage(fieldError);
          return;
        }
      }
      setMessage(translate(locale, 'property.saveError'));
    } finally {
      setPending(false);
    }
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (propertyId === undefined) return;
    const parsed = publicContactSchema.safeParse(contact);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.length === 0 ? 'body' : issue.path.join('.');
        if (errors[field] === undefined) errors[field] = issue.message;
      }
      setContactErrors({ fieldErrors: errors });
      return;
    }
    setContactErrors({ fieldErrors: {} });
    setContactPending(true);
    setContactMessage(undefined);
    try {
      const updated = await adminApi.updatePropertyPublicContact(propertyId, parsed.data);
      setContact(updated);
      setContactMessage(translate(locale, 'admin.publicContact.saved'));
    } catch (cause) {
      if (cause instanceof AdminApiError) {
        setContactErrors(fromProblemDetails(cause.problem));
      } else {
        setContactErrors(
          fromUnknownError(cause, translate(locale, 'admin.publicContact.saveError')),
        );
      }
    } finally {
      setContactPending(false);
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
      <form className="admin-form-stack" onSubmit={saveContact}>
        <AdminFormSection
          description={translate(locale, 'admin.publicContact.help')}
          title={translate(locale, 'admin.publicContact.heading')}
        >
          <Field data-invalid={contactErrors.fieldErrors.phone !== undefined}>
            <FieldLabel htmlFor="property-contact-phone">
              {translate(locale, 'admin.publicContact.phone')}
            </FieldLabel>
            <Input
              id="property-contact-phone"
              aria-invalid={contactErrors.fieldErrors.phone !== undefined}
              disabled={loading || contactPending}
              maxLength={32}
              onChange={(event) =>
                setContact((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="+84901234567"
              value={contact.phone ?? ''}
            />
            {contactErrors.fieldErrors.phone !== undefined ? (
              <FieldError>{contactErrors.fieldErrors.phone}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={contactErrors.fieldErrors.zalo !== undefined}>
            <FieldLabel htmlFor="property-contact-zalo">
              {translate(locale, 'admin.publicContact.zalo')}
            </FieldLabel>
            <Input
              id="property-contact-zalo"
              aria-invalid={contactErrors.fieldErrors.zalo !== undefined}
              disabled={loading || contactPending}
              maxLength={2048}
              onChange={(event) =>
                setContact((current) => ({ ...current, zalo: event.target.value }))
              }
              placeholder="https://zalo.me/..."
              value={contact.zalo ?? ''}
            />
            {contactErrors.fieldErrors.zalo !== undefined ? (
              <FieldError>{contactErrors.fieldErrors.zalo}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={contactErrors.fieldErrors.facebook !== undefined}>
            <FieldLabel htmlFor="property-contact-facebook">
              {translate(locale, 'admin.publicContact.facebook')}
            </FieldLabel>
            <Input
              id="property-contact-facebook"
              aria-invalid={contactErrors.fieldErrors.facebook !== undefined}
              disabled={loading || contactPending}
              maxLength={2048}
              onChange={(event) =>
                setContact((current) => ({ ...current, facebook: event.target.value }))
              }
              placeholder="https://facebook.com/..."
              value={contact.facebook ?? ''}
            />
            {contactErrors.fieldErrors.facebook !== undefined ? (
              <FieldError>{contactErrors.fieldErrors.facebook}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={contactErrors.fieldErrors.address !== undefined}>
            <FieldLabel htmlFor="property-contact-address">
              {translate(locale, 'admin.publicContact.address')}
            </FieldLabel>
            <Input
              id="property-contact-address"
              aria-invalid={contactErrors.fieldErrors.address !== undefined}
              disabled={loading || contactPending}
              maxLength={500}
              onChange={(event) =>
                setContact((current) => ({ ...current, address: event.target.value }))
              }
              value={contact.address ?? ''}
            />
            {contactErrors.fieldErrors.address !== undefined ? (
              <FieldError>{contactErrors.fieldErrors.address}</FieldError>
            ) : null}
          </Field>
        </AdminFormSection>
        {contactErrors.formError !== undefined ? (
          <Alert variant="destructive">
            <AlertTitle>{contactErrors.formError}</AlertTitle>
          </Alert>
        ) : null}
        {contactMessage === undefined ? null : (
          <Alert>
            <AlertTitle>{contactMessage}</AlertTitle>
          </Alert>
        )}
        <FieldGroup>
          <Button disabled={loading || contactPending} type="submit">
            {contactPending
              ? translate(locale, 'profile.saving')
              : translate(locale, 'admin.publicContact.save')}
          </Button>
        </FieldGroup>
      </form>
      <PropertyArrivalAccessEditor />
    </section>
  );
}
