import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminAccessGuard } from '../../components/admin-access-guard';
import { AdminLogoutButton } from '../../components/admin-logout-button';
import { AdminNavigation } from '../../components/admin-navigation';
import { Sidebar, SidebarHeader, SidebarInset, SidebarProvider } from '../../components/ui/sidebar';
import { resolveLocale, translate } from '../../lib/i18n/messages';
import { pathnameHeader } from '../../middleware';

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const requestedLocale = (await cookies()).get('room_locale')?.value;
  const locale = resolveLocale(requestedLocale);
  const pathname = (await headers()).get(pathnameHeader) ?? '';
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login/');
  if (isLoginRoute) {
    // The administrator sign-in page is intentionally chrome-free: no public
    // header, no administrator sidebar, no shell. It must render even when no
    // administrator session exists.
    return <div className="admin-login-shell">{children}</div>;
  }
  return (
    <AdminAccessGuard>
      <SidebarProvider className="admin-layout">
        <a className="skip-link" href="#admin-content">
          {translate(locale, 'admin.skipNavigation')}
        </a>
        <Sidebar className="admin-nav">
          <SidebarHeader>
            <Link className="admin-brand" href="/admin">
              <span>RM</span>
              <strong>Room Management</strong>
            </Link>
          </SidebarHeader>
          <AdminNavigation locale={locale} />
        </Sidebar>
        <SidebarInset className="admin-workspace">
          <header className="admin-topbar">
            <span className="admin-topbar__eyebrow">{translate(locale, 'admin.session')}</span>
            <AdminLogoutButton />
          </header>
          <div id="admin-content" tabIndex={-1}>
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AdminAccessGuard>
  );
}