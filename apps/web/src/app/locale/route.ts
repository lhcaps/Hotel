import { NextResponse } from 'next/server';

import { resolveLocale } from '../../lib/i18n/messages';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale = resolveLocale(typeof body?.locale === 'string' ? body.locale : undefined);
  const response = NextResponse.json({ locale });
  response.cookies.set('room_locale', locale, {
    httpOnly: false,
    maxAge: 31_536_000,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}
