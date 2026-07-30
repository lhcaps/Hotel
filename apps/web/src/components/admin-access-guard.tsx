'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function AdminAccessGuard({ children }: Readonly<{ children: ReactNode }>) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // `/admin/login` is rendered by the bare login layout, so this guard
    // never runs there. For any other `/admin/*` path, verify the
    // administrator session against `/api/v1/admin/me` before exposing
    // the protected shell.
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBase === undefined) {
      router.replace('/admin/login');
      return;
    }

    let active = true;
    const controller = new AbortController();
    void fetch(`${apiBase}/admin/me`, { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) {
          setAllowed(true);
          return;
        }
        // Detect a CUSTOMER session so we can surface a localised
        // "switch account" notice on the login page.
        try {
          const sessionResponse = await fetch(`${apiBase}/customer/profile/session`, {
            credentials: 'include',
            signal: controller.signal,
          });
          const body: unknown = sessionResponse.ok
            ? await sessionResponse.json().catch(() => undefined)
            : undefined;
          if (
            active &&
            typeof body === 'object' &&
            body !== null &&
            'authenticated' in body &&
            (body as { authenticated?: unknown }).authenticated === true
          ) {
            router.replace('/admin/login?customer=1');
            return;
          }
        } catch {
          // ignore — fall through to default redirect
        }
        if (active) router.replace('/admin/login');
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          router.replace('/admin/login');
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [pathname, router]);

  if (!allowed) {
    return <p aria-live="polite">{translate(locale, 'admin.checkingAccess')}</p>;
  }
  return <>{children}</>;
}
