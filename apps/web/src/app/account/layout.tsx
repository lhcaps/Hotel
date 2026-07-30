import { cookies } from 'next/headers';

import { resolveLocale, translate } from '../../lib/i18n/messages';

export default async function AccountLayout({ children }: { readonly children: React.ReactNode }) {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <div className="account-shell">
      <header>
        <nav aria-label={translate(locale, 'public.accountMenu')}>
          <a href="/account/profile">{translate(locale, 'account.profile')}</a>
          <a href="/account/bookings">{translate(locale, 'account.bookings')}</a>
          <a href="/account/settings">{translate(locale, 'account.settings')}</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
