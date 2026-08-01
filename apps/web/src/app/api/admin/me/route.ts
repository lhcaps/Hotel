// Same-origin proxy for `/api/v1/admin/me`. The post-login
// client-side check in the admin login page uses this route so the
// cookie set by the sign-in proxy (on the web origin) is automatically
// forwarded by the browser. The server-side admin layout also uses
// the upstream endpoint directly via `resolveAdminSessionFromHeaders`.

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { resolveInternalApiOrigin } from '../../../../lib/internal-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest): Promise<NextResponse> {
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

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join('; ');

  const upstreamHeaders = new Headers({
    accept: 'application/json',
    origin: _request.nextUrl.origin,
  });
  if (cookieHeader.length > 0) {
    upstreamHeaders.set('cookie', cookieHeader);
  }

  const upstream = await fetch(`${origin}/api/v1/admin/me`, {
    method: 'GET',
    headers: upstreamHeaders,
    cache: 'no-store',
  });

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}
