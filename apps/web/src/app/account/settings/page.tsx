import { cookies, headers } from 'next/headers';

import { AccountLanguageSettings } from '../../../components/account-language-settings';
import { resolveLocale, translate } from '../../../lib/i18n/messages';

export default async function AccountSettingsPage() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBase === undefined) {
    return (
      <main>
        <p>{translate(locale, 'account.serverUnavailable')}</p>
      </main>
    );
  }
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const response = await fetch(`${new URL(apiBase).origin}/api/v1/customer/profile`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (response.status === 401) {
    return (
      <main>
        <p>
          <a href="/login">{translate(locale, 'account.signInSettings')}</a>
        </p>
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

  return (
    <main className="account-page" id="main-content">
      <div className="account-page__inner">
        <header className="account-page__heading">
          <h1>{translate(locale, 'account.settingsHeading')}</h1>
        </header>
        <AccountLanguageSettings locale={locale} />
      </div>
    </main>
  );
}
