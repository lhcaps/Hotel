// Same-origin proxy for the Better Auth sign-out endpoint. Mirrors
// the sign-in proxy so the browser sees a single origin for the
// session cookie.

import { type NextRequest, NextResponse } from 'next/server';
import { resolveInternalApiOrigin } from '../../../../lib/internal-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'better-auth.session_token';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = resolveInternalApiOrigin();
  if (origin === undefined) {
    return NextResponse.json(
      {
        code: 'INTERNAL_API_BASE_URL_MISSING',
        message: 'Internal API base URL is not configured.',
      },
      { status: 500 },
    );
  }

  // Better Auth's sign-out handler returns success on an empty body. Sending
  // `content-type: application/json` without a JSON payload triggers a 400,
  // so we omit the content-type header and let the upstream reject the
  // request only if it is genuinely malformed.
  const upstreamHeaders = new Headers({
    accept: 'application/json',
    origin: request.nextUrl.origin,
  });
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader !== null) {
    upstreamHeaders.set('cookie', cookieHeader);
  }

  const upstream = await fetch(`${origin}/api/auth/sign-out`, {
    method: 'POST',
    headers: upstreamHeaders,
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  const upstreamSetCookies = upstream.headers.getSetCookie();
  for (const setCookie of upstreamSetCookies) {
    const pair = setCookie.split(';')[0];
    if (pair === undefined || pair.length === 0) continue;
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const attrs = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
    const maxAgeMatch = /Max-Age=(-?\d+)/i.exec(setCookie);
    const expiresMatch = /Expires=([^;]+)/i.exec(setCookie);
    if (maxAgeMatch !== null) attrs.push(`Max-Age=${maxAgeMatch[1]}`);
    if (expiresMatch !== null) attrs.push(`Expires=${expiresMatch[1]}`);
    responseHeaders.append('set-cookie', attrs.join('; '));
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
