import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

import './globals.css';
import { LocaleProvider } from '../components/locale-provider';
import { PublicHeader } from '../components/public-header';
import { resolveLocale } from '../lib/i18n/messages';
import { pathnameHeader } from '../middleware';

export const metadata: Metadata = {
  title: 'Room Management',
  description: 'Book a room, manage a booking, or access your customer account.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestedLocale = (await cookies()).get('room_locale')?.value;
  const locale = resolveLocale(requestedLocale);
  const pathname = (await headers()).get(pathnameHeader) ?? '';
  const isAdminRoute = pathname.startsWith('/admin');
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          {isAdminRoute ? children : <PublicHeader locale={locale}>{children}</PublicHeader>}
        </LocaleProvider>
      </body>
    </html>
  );
}