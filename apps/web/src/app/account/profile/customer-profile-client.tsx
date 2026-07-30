'use client';

import { useState } from 'react';

import { useLocale } from '../../../components/locale-provider';
import { translate } from '../../../lib/i18n/messages';

interface ProfilePayload {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly phone: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly ward: string | null;
  readonly district: string | null;
  readonly province: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly updatedAt: string;
}

interface CustomerProfileClientProps {
  readonly initialProfile: ProfilePayload;
  readonly apiBase: string;
}

export function CustomerProfileClient({ initialProfile, apiBase }: CustomerProfileClientProps) {
  const locale = useLocale();
  const [profile, setProfile] = useState<ProfilePayload>(initialProfile);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  async function save(form: FormData) {
    setPending(true);
    setError(undefined);
    setInfo(undefined);
    const body = {
      name: String(form.get('name') ?? ''),
      phone: readNullableField(form.get('phone')),
      addressLine1: readNullableField(form.get('addressLine1')),
      addressLine2: readNullableField(form.get('addressLine2')),
      ward: readNullableField(form.get('ward')),
      district: readNullableField(form.get('district')),
      province: readNullableField(form.get('province')),
      postalCode: readNullableField(form.get('postalCode')),
      countryCode: String(form.get('countryCode') ?? profile.countryCode).toUpperCase(),
    };
    try {
      const response = await fetch(`${new URL(apiBase).origin}/api/v1/customer/profile`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(translate(locale, 'profile.saveError'));
      }
      const updated = (await response.json()) as ProfilePayload;
      setProfile(updated);
      setInfo(translate(locale, 'profile.saved'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, 'profile.saveError'));
    } finally {
      setPending(false);
    }
  }

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
        <form action={save} className="profile-form">
          <section className="profile-form__section">
            <label>
              {translate(locale, 'profile.fullName')}
              <input name="name" defaultValue={profile.name} required maxLength={120} />
            </label>
            <label>
              {translate(locale, 'profile.phone')}
              <input name="phone" defaultValue={profile.phone ?? ''} />
            </label>
          </section>
          <fieldset className="profile-form__section">
            <legend>{translate(locale, 'profile.address')}</legend>
            <label>
              {translate(locale, 'profile.addressLine1')}
              <input
                name="addressLine1"
                defaultValue={profile.addressLine1 ?? ''}
                maxLength={200}
              />
            </label>
            <label>
              {translate(locale, 'profile.addressLine2')}
              <input
                name="addressLine2"
                defaultValue={profile.addressLine2 ?? ''}
                maxLength={200}
              />
            </label>
            <label>
              {translate(locale, 'profile.ward')}
              <input name="ward" defaultValue={profile.ward ?? ''} maxLength={200} />
            </label>
            <label>
              {translate(locale, 'profile.district')}
              <input name="district" defaultValue={profile.district ?? ''} maxLength={200} />
            </label>
            <label>
              {translate(locale, 'profile.province')}
              <input name="province" defaultValue={profile.province ?? ''} maxLength={200} />
            </label>
            <label>
              {translate(locale, 'profile.postalCode')}
              <input name="postalCode" defaultValue={profile.postalCode ?? ''} maxLength={32} />
            </label>
            <label>
              {translate(locale, 'profile.country')}
              <input
                name="countryCode"
                defaultValue={profile.countryCode}
                maxLength={2}
                pattern="[A-Z]{2}"
                required
              />
            </label>
          </fieldset>
          {error === undefined ? null : <p role="alert">{error}</p>}
          {info === undefined ? null : <p role="status">{info}</p>}
          <button className="primary-button profile-form__submit" disabled={pending} type="submit">
            {pending ? translate(locale, 'profile.saving') : translate(locale, 'profile.save')}
          </button>
        </form>
      </div>
    </main>
  );
}

function readNullableField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
