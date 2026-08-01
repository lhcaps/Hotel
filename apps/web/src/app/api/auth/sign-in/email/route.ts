// Same-origin proxy for the Better Auth sign-in endpoint.
//
// The browser submits the email/password form from the web origin
// (e.g. http://127.0.0.1:3000) and the API lives on a different
// loopback name (e.g. http://localhost:3001). Browsers treat those
// two hosts as different sites, so a direct fetch from the page
// would receive the session cookie under `SameSite=Lax` but the
// browser would refuse to send it back on the subsequent admin
// probe because the page is on the other site.
//
// This proxy forwards the credentials to the API server-side and
// re-emits the session cookie on the web origin, so the browser sees
// a single origin for the cookie and includes it on subsequent
// same-origin requests. The server-side admin layout then forwards
// the cookie to `/api/v1/admin/me` via an explicit header.

import { type NextRequest, NextResponse } from 'next/server';
import { resolveInternalApiOrigin } from '../../../../../lib/internal-api';

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: 'Request body must be JSON.' },
      { status: 400 },
    );
  }

  const upstreamHeaders = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
    origin: request.nextUrl.origin,
  });
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader !== null) {
    upstreamHeaders.set('cookie', cookieHeader);
  }

  const upstream = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: upstreamHeaders,
    body: JSON.stringify(body),
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
    // Rewrite the cookie so the browser stores it on the WEB origin
    // (the same origin as the page). This is the surgical fix that
    // makes `SameSite=Lax` allow the protected layout to forward it
    // on the next navigation. We preserve the path and the original
    // security attributes.
    const expiresMatch = /Expires=([^;]+)/i.exec(setCookie);
    const maxAgeMatch = /Max-Age=(\d+)/i.exec(setCookie);
    responseHeaders.append(
      'set-cookie',
      [
        `${name}=${value}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        maxAgeMatch !== null ? `Max-Age=${maxAgeMatch[1]}` : null,
        expiresMatch !== null ? `Expires=${expiresMatch[1]}` : null,
      ]
        .filter((segment): segment is string => segment !== null)
        .join('; '),
    );
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
