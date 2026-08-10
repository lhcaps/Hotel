import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminLogoutButton } from '../../../components/admin-logout-button';
import { AdminNavigation } from '../../../components/admin-navigation';
import { Sidebar, SidebarHeader, SidebarInset } from '../../../components/ui/sidebar';
import { AdminAppShell, AdminProfileMenu, AdminTopbar } from '../../../components/admin/admin-ui';
import { resolveLocale, translate } from '../../../lib/i18n/messages';
import { resolveAdminSessionFromHeaders } from '../../../lib/admin-session-server';

const PATHNAME_HEADER = 'x-room-pathname';

/**
 * Server-side administrator authority boundary. Every protected `/admin/**`
 * route lives under this layout. The layout forwards the inbound HttpOnly
 * session cookie to `/api/v1/admin/me` BEFORE protected content is rendered.
 *
 * The browser cannot bypass this gate: the layout itself decides whether to
 * render the protected shell. The previous client-side `AdminAccessGuard`
 * ran as a client effect inside the protected shell, which leaked the public
 * layout skeleton into the response and could be observed by automation.
 * This layout eliminates that leak by performing the redirect inside a
 * Server Component that runs before any protected JSX reaches the wire.
 */
export default async function AdminProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale(cookieStore.get('room_locale')?.value);
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join('; ');

  const resolution = await resolveAdminSessionFromHeaders({ cookie: cookieHeader });

  if (resolution.kind === 'customer') {
    redirect('/admin/login?customer=1');
  }
  if (resolution.kind === 'unauthenticated' || resolution.kind === 'malformed') {
    redirect('/admin/login');
  }

  const pathname = headerStore.get(PATHNAME_HEADER) ?? '';
  const restrictedProfileNavigation: Record<
    string,
    ReadonlySet<string> | undefined
  > = {
    ROOM_STATUS_VIEWER: new Set(['/admin/room-operations', '/admin/profile']),
    HOUSEKEEPING_STAFF: new Set(['/admin/room-operations', '/admin/profile']),
  };
  
  const allowedPaths = restrictedProfileNavigation[resolution.session.profileCode ?? ''];
  if (
    allowedPaths &&
    pathname !== '' &&
    !allowedPaths.has(pathname)
  ) {
    redirect('/admin/room-operations');
  }

  // Header only exists to silence "unused" warnings; the layout intentionally
  // does not branch on pathname because every nested page is protected.
  void pathname;

  return (
    <AdminAppShell>
      <a className="skip-link" href="#admin-content">
        {translate(locale, 'admin.skipNavigation')}
      </a>
      <Sidebar className="admin-nav" collapsible="offcanvas" variant="sidebar">
        <SidebarHeader>
          <Link className="admin-brand" href="/admin">
            <span>RM</span>
            <strong>Room Management</strong>
          </Link>
        </SidebarHeader>
        <AdminNavigation
          locale={locale}
          permissions={resolution.session.permissions}
          profileCode={resolution.session.profileCode}
        />
      </Sidebar>
      <SidebarInset className="admin-workspace">
        <AdminTopbar
          identity={null}
          actions={
            <AdminProfileMenu
              displayName={resolution.session.displayName}
              role={resolution.session.profileLabelVi}
              {...(resolution.session.department
                ? { department: resolution.session.department.name }
                : {})}
              logout={<AdminLogoutButton />}
            />
          }
        />
        <div id="admin-content" className="admin-content" tabIndex={-1}>
          {children}
        </div>
      </SidebarInset>
    </AdminAppShell>
  );
}
