import { cookies, headers } from 'next/headers';

import { resolveLocale, translate } from '../../../lib/i18n/messages';

import { CustomerProfileClient } from './customer-profile-client';

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

export default async function CustomerProfilePage() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBase === undefined) {
    return (
      <main>
        <p>{translate(locale, 'account.serverUnavailable')}</p>
      </main>
    );
  }
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie') ?? '';
  const response = await fetch(`${new URL(apiBase).origin}/api/v1/customer/profile`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (response.status === 401) {
    return (
      <main>
        <p><a href="/login">{translate(locale, 'account.signInProfile')}</a></p>
      </main>
    );
  }
  if (!response.ok) {
    return (
      <main>
        <p>{translate(locale, 'account.profileLoadError')}</p>
      </main>
    );
  }
  const profile = (await response.json()) as ProfilePayload;
  return <CustomerProfileClient initialProfile={profile} apiBase={apiBase} />;
}
