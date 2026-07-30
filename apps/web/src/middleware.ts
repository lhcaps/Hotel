import { NextResponse, type NextRequest } from 'next/server';

/**
 * Annotate every request with the request pathname so server components can
 * make layout-routing decisions without leaking pathname-aware shell content
 * into an unauthorised context (for example, the public customer header
 * rendering above the administrator sign-in page).
 *
 * The header is consumed by route-group layouts under
 * `apps/web/src/app/(public)`, `apps/web/src/app/admin/login`, and
 * `apps/web/src/app/admin/(protected)`.
 */
const PATHNAME_HEADER = 'x-room-pathname';

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.).*)'],
};

export const pathnameHeader = PATHNAME_HEADER;