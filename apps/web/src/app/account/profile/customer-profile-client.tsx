'use client';

import { useState } from 'react';

import { useLocale } from '../../../components/locale-provider';
import { Field, FieldError, FieldLabel } from '../../../components/ui/field';
import { translate } from '../../../lib/i18n/messages';
import { resolvePublicApiOrigin } from '../../../lib/public-api-origin';
import { SessionLogoutButton } from '../../../components/session-logout-button';
import {
  fromProblemDetails,
  fromUnknownError,
  type FieldErrorState,
} from '../../../lib/form-error';
import { customerProfileUpdateSchema } from '@room/contracts';

interface ProfilePayload {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly accountStatus: 'ACTIVE' | 'DISABLED';
  readonly phone: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly ward: string | null;
  readonly district: string | null;
  readonly province: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly updatedAt: string;
  readonly sessionExpiresAt: string;
}

interface CustomerProfileClientProps {
  readonly initialProfile: ProfilePayload;
  readonly apiBase: string;
}

interface ProblemDetail {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly code?: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly requestId?: string;
  readonly errors?: ReadonlyArray<{ field: string; message: string; code?: string }>;
}

export function CustomerProfileClient({ initialProfile, apiBase }: CustomerProfileClientProps) {
  const locale = useLocale();
  const [profile, setProfile] = useState<ProfilePayload>(initialProfile);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrorState>({ fieldErrors: {} });
  const [info, setInfo] = useState<string>();

  async function save(form: FormData) {
    setPending(true);
    setErrors({ fieldErrors: {} });
    setInfo(undefined);
    const formEntries = {
      name: String(form.get('name') ?? ''),
      phone: readField(form.get('phone')),
      addressLine1: readField(form.get('addressLine1')),
      addressLine2: readField(form.get('addressLine2')),
      ward: readField(form.get('ward')),
      district: readField(form.get('district')),
      province: readField(form.get('province')),
      postalCode: readField(form.get('postalCode')),
      countryCode: String(form.get('countryCode') ?? profile.countryCode).toUpperCase(),
    };
    const parsed = customerProfileUpdateSchema.safeParse(formEntries);
    if (!parsed.success) {
      const zodErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.length === 0 ? 'body' : issue.path.join('.');
        if (zodErrors[field] === undefined) zodErrors[field] = issue.message;
      }
      setErrors({ fieldErrors: zodErrors });
      setPending(false);
      return;
    }
    try {
      const origin = resolvePublicApiOrigin(apiBase);
      if (origin === undefined) throw new Error(translate(locale, 'profile.saveError'));
      const response = await fetch(`${origin}/api/v1/customer/profile`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const problem = (await safeReadProblem(response)) ?? {
          detail: translate(locale, 'profile.saveError'),
        };
        const errors = [...(problem.errors ?? [])];
        setErrors(
          fromProblemDetails({
            type: problem.type ?? 'about:blank',
            title: problem.title ?? response.statusText,
            status: problem.status ?? response.status,
            code: (problem as { readonly code?: string }).code ?? '',
            detail: problem.detail ?? translate(locale, 'profile.saveError'),
            requestId: problem.requestId ?? '',
            errors,
          } as unknown as Parameters<typeof fromProblemDetails>[0]),
        );
        setPending(false);
        return;
      }
      const updated = (await response.json()) as ProfilePayload;
      setProfile(updated);
      setInfo(translate(locale, 'profile.saved'));
    } catch (cause) {
      setErrors(fromUnknownError(cause, translate(locale, 'profile.saveError')));
    } finally {
      setPending(false);
    }
  }

  const fieldError = (name: string) => errors.fieldErrors[name];

  return (
    <main className="account-page" id="main-content">
      <div className="account-page__inner">
        <header className="account-page__heading">
          <h1>{translate(locale, 'profile.heading')}</h1>
          <p>{translate(locale, 'profile.emailHelp')}</p>
        </header>
        <section className="profile-identity" aria-label={translate(locale, 'profile.heading')}>
          <span className="profile-identity__avatar" aria-hidden="true">
            {profile.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{profile.name}</strong>
            <p>{profile.email}</p>
          </div>
        </section>
        <dl className="profile-session-summary">
          <div>
            <dt>{translate(locale, 'profile.accountStatus')}</dt>
            <dd>{profile.accountStatus}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'profile.activeSession')}</dt>
            <dd>{profile.sessionExpiresAt}</dd>
          </div>
        </dl>
        <form action={save} className="profile-form" noValidate>
          <section className="profile-form__section">
            <Field data-invalid={fieldError('name') !== undefined}>
              <FieldLabel htmlFor="profile-name">
                {translate(locale, 'profile.fullName')}
              </FieldLabel>
              <input
                id="profile-name"
                name="name"
                defaultValue={profile.name}
                required
                maxLength={120}
                aria-invalid={fieldError('name') !== undefined}
              />
              {fieldError('name') !== undefined ? (
                <FieldError>{fieldError('name')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={fieldError('phone') !== undefined}>
              <FieldLabel htmlFor="profile-phone">{translate(locale, 'profile.phone')}</FieldLabel>
              <input
                id="profile-phone"
                name="phone"
                defaultValue={profile.phone ?? ''}
                aria-invalid={fieldError('phone') !== undefined}
              />
              {fieldError('phone') !== undefined ? (
                <FieldError>{fieldError('phone')}</FieldError>
              ) : null}
            </Field>
          </section>
          <fieldset className="profile-form__section">
            <legend>{translate(locale, 'profile.address')}</legend>
            <Field data-invalid={fieldError('addressLine1') !== undefined}>
              <FieldLabel htmlFor="profile-addressLine1">
                {translate(locale, 'profile.addressLine1')}
              </FieldLabel>
              <input
                id="profile-addressLine1"
                name="addressLine1"
                defaultValue={profile.addressLine1 ?? ''}
                maxLength={200}
                aria-invalid={fieldError('addressLine1') !== undefined}
              />
              {fieldError('addressLine1') !== undefined ? (
                <FieldError>{fieldError('addressLine1')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={fieldError('addressLine2') !== undefined}>
              <FieldLabel htmlFor="profile-addressLine2">
                {translate(locale, 'profile.addressLine2')}
              </FieldLabel>
              <input
                id="profile-addressLine2"
                name="addressLine2"
                defaultValue={profile.addressLine2 ?? ''}
                maxLength={200}
                aria-invalid={fieldError('addressLine2') !== undefined}
              />
              {fieldError('addressLine2') !== undefined ? (
                <FieldError>{fieldError('addressLine2')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={fieldError('ward') !== undefined}>
              <FieldLabel htmlFor="profile-ward">{translate(locale, 'profile.ward')}</FieldLabel>
              <input
                id="profile-ward"
                name="ward"
                defaultValue={profile.ward ?? ''}
                maxLength={200}
                aria-invalid={fieldError('ward') !== undefined}
              />
              {fieldError('ward') !== undefined ? (
                <FieldError>{fieldError('ward')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={fieldError('district') !== undefined}>
              <FieldLabel htmlFor="profile-district">
                {translate(locale, 'profile.district')}
              </FieldLabel>
              <input
                id="profile-district"
                name="district"
                defaultValue={profile.district ?? ''}
                maxLength={200}
                aria-invalid={fieldError('district') !== undefined}
              />
              {fieldError('district') !== undefined ? (
                <FieldError>{fieldError('district')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={fieldError('province') !== undefined}>
              <FieldLabel htmlFor="profile-province">
                {translate(locale, 'profile.province')}
              </FieldLabel>
              <input
                id="profile-province"
                name="province"
                defaultValue={profile.province ?? ''}
                maxLength={200}
                aria-invalid={fieldError('province') !== undefined}
              />
              {fieldError('province') !== undefined ? (
                <FieldError>{fieldError('province')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={fieldError('postalCode') !== undefined}>
              <FieldLabel htmlFor="profile-postalCode">
                {translate(locale, 'profile.postalCode')}
              </FieldLabel>
              <input
                id="profile-postalCode"
                name="postalCode"
                defaultValue={profile.postalCode ?? ''}
                maxLength={32}
                aria-invalid={fieldError('postalCode') !== undefined}
              />
              {fieldError('postalCode') !== undefined ? (
                <FieldError>{fieldError('postalCode')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={fieldError('countryCode') !== undefined}>
              <FieldLabel htmlFor="profile-countryCode">
                {translate(locale, 'profile.country')}
              </FieldLabel>
              <input
                id="profile-countryCode"
                name="countryCode"
                defaultValue={profile.countryCode}
                maxLength={2}
                pattern="[A-Z]{2}"
                required
                aria-invalid={fieldError('countryCode') !== undefined}
              />
              {fieldError('countryCode') !== undefined ? (
                <FieldError>{fieldError('countryCode')}</FieldError>
              ) : null}
            </Field>
          </fieldset>
          {errors.formError !== undefined ? (
            <p className="profile-form__error" role="alert">
              {errors.formError}
              {errors.requestId !== undefined
                ? ` · ${translate(locale, 'admin.errors.requestIdSuffix', { id: errors.requestId })}`
                : ''}
            </p>
          ) : null}
          {info === undefined ? null : (
            <p className="profile-form__info" role="status">
              {info}
            </p>
          )}
          <button className="primary-button profile-form__submit" disabled={pending} type="submit">
            {pending ? translate(locale, 'profile.saving') : translate(locale, 'profile.save')}
          </button>
        </form>
        <SessionLogoutButton redirectTo="/login" />
      </div>
    </main>
  );
}

function readField(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function safeReadProblem(response: Response): Promise<ProblemDetail | undefined> {
  try {
    return (await response.json()) as ProblemDetail;
  } catch {
    return undefined;
  }
}
