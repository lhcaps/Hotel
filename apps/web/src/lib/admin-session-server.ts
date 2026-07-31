import { adminMeSchema, type AdminMe } from '@room/contracts/admin';

/**
 * Result of a server-side check of the administrator session. The protected
 * admin layout translates this discriminated union into either an authorised
 * render, a redirect to `/admin/login` (with optional `customer=1` flag), or a
 * visible error state. The shape is intentionally narrow: the layout must not
 * make any further decision based on data the API did not return.
 *
 * `customer` is reported separately from `unauthenticated` so the layout can
 * surface the "switch account" notice. It is computed by also calling
 * `/api/v1/customer/profile/session`, not by interpreting `/admin/me`.
 */
export type AdminSessionResolution =
  | { kind: 'admin'; session: AdminMe }
  | { kind: 'customer' }
  | { kind: 'unauthenticated' }
  | { kind: 'malformed' };

export interface AdminSessionHeaders {
  readonly cookie?: string | undefined;
}

export interface AdminSessionOptions {
  readonly baseUrl?: string | undefined;
  /** When true, also probe `/customer/profile/session` to distinguish
   *  an unauthenticated request from a request carrying a CUSTOMER session.
   *  Defaults to true; tests may disable it. */
  readonly probeCustomer?: boolean | undefined;
}

const ADMIN_ME_PATH = '/admin/me';
const CUSTOMER_SESSION_PATH = '/customer/profile/session';

interface CustomerSessionProbe {
  readonly authenticated: boolean;
}

/**
 * Resolve the current administrator session by forwarding the inbound cookie
 * to the canonical `/api/v1/admin/me` endpoint and validating the response
 * at runtime with the shared `@room/contracts` schema.
 *
 * The resolver MUST NOT trust any browser-supplied role flag, query parameter,
 * or local state. The API response is the only authority.
 */
export async function resolveAdminSessionFromHeaders(
  headers: AdminSessionHeaders,
  options: AdminSessionOptions = {},
): Promise<AdminSessionResolution> {
  const baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (baseUrl === undefined || baseUrl.length === 0) {
    return { kind: 'unauthenticated' };
  }
  const probeCustomer = options.probeCustomer !== false;

  const forwardHeaders: Record<string, string> = {
    accept: 'application/json',
  };
  if (typeof headers.cookie === 'string' && headers.cookie.length > 0) {
    forwardHeaders.cookie = headers.cookie;
  }

  const adminResult = await fetchAdminMe(baseUrl, forwardHeaders);

  if (adminResult.kind === 'admin') {
    return adminResult;
  }
  if (adminResult.kind === 'malformed') {
    return { kind: 'malformed' };
  }
  if (adminResult.kind === 'unauthenticated' && probeCustomer) {
    const customerResult = await probeCustomerSession(baseUrl, forwardHeaders);
    if (customerResult.kind === 'customer') {
      return { kind: 'customer' };
    }
  }
  return { kind: 'unauthenticated' };
}

type AdminMeFetchResult =
  { kind: 'admin'; session: AdminMe } | { kind: 'unauthenticated' } | { kind: 'malformed' };

async function fetchAdminMe(
  baseUrl: string,
  forwardHeaders: Record<string, string>,
): Promise<AdminMeFetchResult> {
  const target = new URL(
    `.${ADMIN_ME_PATH}`,
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
  ).toString();
  let response: Response;
  try {
    response = await fetch(target, {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    return { kind: 'unauthenticated' };
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: 'unauthenticated' };
  }
  if (!response.ok) {
    return { kind: 'unauthenticated' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'malformed' };
  }

  const parsed = adminMeSchema.safeParse(body);
  if (!parsed.success) {
    return { kind: 'malformed' };
  }
  return { kind: 'admin', session: parsed.data };
}

type CustomerProbeResult = { kind: 'customer' } | { kind: 'unauthenticated' };

async function probeCustomerSession(
  baseUrl: string,
  forwardHeaders: Record<string, string>,
): Promise<CustomerProbeResult> {
  const target = new URL(
    `.${CUSTOMER_SESSION_PATH}`,
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
  ).toString();
  let response: Response;
  try {
    response = await fetch(target, {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    return { kind: 'unauthenticated' };
  }
  if (!response.ok) {
    return { kind: 'unauthenticated' };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'unauthenticated' };
  }
  if (!isCustomerSessionAuthenticated(body)) {
    return { kind: 'unauthenticated' };
  }
  return { kind: 'customer' };
}

function isCustomerSessionAuthenticated(body: unknown): body is CustomerSessionProbe {
  return (
    typeof body === 'object' &&
    body !== null &&
    'authenticated' in body &&
    (body as { authenticated: unknown }).authenticated === true
  );
}
