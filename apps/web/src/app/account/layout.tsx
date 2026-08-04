import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { resolveLocale, translate } from '../../lib/i18n/messages';
import { resolveAdminSessionFromHeaders } from '../../lib/admin-session-server';

export default async function AccountLayout({ children }: { readonly children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get('room_locale')?.value);
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join('; ');
  const resolution = await resolveAdminSessionFromHeaders({
    cookie: cookieHeader || (await headers()).get('cookie') || undefined,
  });
  if (resolution.kind === 'admin') redirect('/admin/profile');
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
