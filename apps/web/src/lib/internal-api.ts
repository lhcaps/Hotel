/**
 * Server-only API topology for Next.js route handlers and Server Components.
 *
 * Browser code uses NEXT_PUBLIC_API_BASE_URL. Server code must never reuse
 * that public value: in production it points at Caddy and would route a
 * server-side proxy request back into Next.js. INTERNAL_API_BASE_URL instead
 * targets the API service directly (for example http://api:3001/api/v1).
 */
export function resolveInternalApiBaseUrl(): string | undefined {
  const value = process.env.INTERNAL_API_BASE_URL;
  if (value === undefined || value.length === 0) return undefined;
  try {
    return new URL(value).toString().replace(/\/$/u, '');
  } catch {
    return undefined;
  }
}

export function resolveInternalApiOrigin(): string | undefined {
  const baseUrl = resolveInternalApiBaseUrl();
  if (baseUrl === undefined) return undefined;
  return new URL(baseUrl).origin;
}
