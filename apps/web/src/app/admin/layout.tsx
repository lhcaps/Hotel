import { cookies, headers } from 'next/headers';
import type { ReactNode } from 'react';

import { pathnameHeader } from '../../middleware';

/**
 * Outer administrator layout. The administrator sign-in page is intentionally
 * chrome-free: no public header, no administrator sidebar, no shell. It must
 * render even when no administrator session exists. Every other `/admin/**`
 * path is delegated to the nested `(protected)` layout, which performs the
 * server-side authority check before any protected content is rendered.
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = (await headers()).get(pathnameHeader) ?? '';
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login/');
  if (isLoginRoute) {
    return <div className="admin-login-shell">{children}</div>;
  }
  // Suppress unused warnings; the outer layout never branches on locale for
  // the chrome-free shell because the login page reads cookies directly.
  void cookies;
  return <>{children}</>;
}
