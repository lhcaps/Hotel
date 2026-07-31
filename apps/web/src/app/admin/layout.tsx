import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { pathnameHeader } from '../../middleware';
import { resolveAdminSessionFromHeaders } from '../../lib/admin-session-server';

/**
 * Outer administrator layout. The administrator sign-in page is intentionally
 * chrome-free: no public header, no administrator sidebar, no shell. It must
 * render even when no administrator session exists. Every other `/admin/**`
 * path is delegated to the nested `(protected)` layout, which performs the
 * server-side authority check before any protected content is rendered.
 *
 * The layout also enforces one extra rule: an authenticated administrator who
 * navigates back to `/admin/login` is redirected to the dashboard immediately.
 * This keeps the user out of the chrome-free shell once they are signed in
 * and prevents the redirect loop the browser would otherwise see when the
 * protected layout forwards them to `/admin/login` while the cookie is still
 * valid.
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const pathname = headerStore.get(pathnameHeader) ?? '';
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

  if (isLoginRoute) {
    // If the request carries a valid ADMIN session, jump straight to the
    // dashboard so the signed-in user never sees the login form again. The
    // resolution is a fast server-side call to `/api/v1/admin/me` using the
    // same cookie the protected layout would forward.
    const cookieHeader = cookieStore
      .getAll()
      .map((entry) => `${entry.name}=${entry.value}`)
      .join('; ');
    const resolution = await resolveAdminSessionFromHeaders({ cookie: cookieHeader });
    if (resolution.kind === 'admin') {
      redirect('/admin');
    }
    return <div className="admin-login-shell">{children}</div>;
  }
  // Suppress unused warnings; the outer layout never branches on locale for
  // the chrome-free shell because the login page reads cookies directly.
  void cookies;
  return <>{children}</>;
}
