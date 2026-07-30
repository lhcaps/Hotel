import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const adminArtifactPath = resolve(import.meta.dirname, '../docs/openapi/admin-v1.json');
const publicArtifactPath = resolve(import.meta.dirname, '../docs/openapi/public-v1.json');

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

type HttpMethod = (typeof HTTP_METHODS)[number];

type PathItem = Partial<Record<HttpMethod, Operation>>;

type Operation = {
  readonly operationId?: string;
  readonly responses?: Record<string, unknown>;
  readonly security?: ReadonlyArray<Record<string, ReadonlyArray<string>>>;
  readonly parameters?: ReadonlyArray<unknown>;
};

type JsonObject = Record<string, unknown>;

type OpenApiDocument = {
  readonly openapi?: string;
  readonly info?: { readonly title?: string; readonly version?: string };
  readonly security?: ReadonlyArray<Record<string, ReadonlyArray<string>>>;
  readonly paths?: Record<string, JsonObject>;
  readonly components?: {
    readonly responses?: Record<string, JsonObject>;
    readonly securitySchemes?: Record<string, JsonObject>;
  };
};

async function parseArtifact(path: string): Promise<NonNullable<OpenApiDocument>> {
  return JSON.parse(await readFile(path, 'utf8')) as NonNullable<OpenApiDocument>;
}

function resolveReference(document: OpenApiDocument, reference: string): unknown {
  if (!reference.startsWith('#/')) {
    throw new Error(`External OpenAPI reference is not permitted: ${reference}`);
  }
  return reference
    .slice(2)
    .split('/')
    .reduce<unknown>((current, segment) => {
      if (
        typeof current !== 'object' ||
        current === null ||
        !(segment in (current as Record<string, unknown>))
      ) {
        throw new Error(`Unresolved OpenAPI reference: ${reference}`);
      }
      return (current as Record<string, unknown>)[segment];
    }, document);
}

function visitReferences(document: OpenApiDocument): void {
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.$ref === 'string') resolveReference(document, record.$ref);
    Object.values(record).forEach(walk);
  };
  walk(document);
}

function isHttpMethod(key: string): key is HttpMethod {
  return (HTTP_METHODS as readonly string[]).includes(key);
}

function collectOperations(
  paths: OpenApiDocument['paths'],
): Map<string, { path: string; method: HttpMethod; id: string }> {
  const ids = new Map<string, { path: string; method: HttpMethod; id: string }>();
  if (paths === undefined) return ids;
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [key, value] of Object.entries(pathItem)) {
      if (!isHttpMethod(key)) continue;
      const operation = value as Operation;
      const id = operation.operationId;
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error(`Missing operationId on ${key.toUpperCase()} ${path}`);
      }
      if (ids.has(id)) {
        const existing = ids.get(id);
        throw new Error(
          `Duplicate operationId "${id}" on ${key.toUpperCase()} ${path} (already used by ${existing?.method.toUpperCase()} ${existing?.path})`,
        );
      }
      ids.set(id, { path, method: key, id });
    }
  }
  return ids;
}

function assertNoPublicRoomLeakageInPublic(document: OpenApiDocument): void {
  const serialized = JSON.stringify(document);
  if (/roomNumber|physicalRoom|room_id/i.test(serialized)) {
    throw new Error(`public-v1.json must not expose physical-room identifiers.`);
  }
}

function assertHasResponse(
  responses: OpenApiDocument['components'] extends infer C
    ? C extends { responses?: infer R }
      ? R
      : never
    : never,
  name: string,
  artifactLabel: string,
): void {
  const collection = responses as Record<string, JsonObject> | undefined;
  const response = collection?.[name];
  if (
    response === undefined ||
    typeof response.description !== 'string' ||
    response.description.length === 0 ||
    !response.content
  ) {
    throw new Error(
      `${artifactLabel} response component ${name} must have description and content.`,
    );
  }
}

function assertEffectiveCookieAuth(
  operation: Operation,
  path: string,
  method: HttpMethod,
  artifactLabel: string,
  topLevelSecurity: ReadonlyArray<Record<string, ReadonlyArray<string>>> | undefined,
): void {
  const security = operation.security ?? topLevelSecurity;
  if (!Array.isArray(security) || !security.some((scheme) => 'cookieAuth' in scheme)) {
    throw new Error(
      `${artifactLabel} ${method.toUpperCase()} ${path} must declare effective cookieAuth security.`,
    );
  }
}

function pathItemFor(paths: Record<string, JsonObject>, path: string): PathItem {
  const entry = paths[path];
  if (entry === undefined) {
    throw new Error(`OpenAPI document must define path ${path}.`);
  }
  const result: Partial<Record<HttpMethod, Operation>> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!isHttpMethod(key)) continue;
    result[key] = value as Operation;
  }
  return result;
}

// --- admin-v1.json ------------------------------------------------------------
const admin = await parseArtifact(adminArtifactPath);
visitReferences(admin);
const adminPaths = admin.paths;
if (!adminPaths) {
  throw new Error('admin-v1.json must define paths.');
}

const adminSecuritySchemes = admin.components?.securitySchemes;
if (
  !adminSecuritySchemes ||
  typeof adminSecuritySchemes !== 'object' ||
  adminSecuritySchemes.cookieAuth === undefined
) {
  throw new Error('admin-v1.json must declare components.securitySchemes.cookieAuth.');
}

const requiredAdminPaths = [
  '/api/v1/admin/rate-plans',
  '/api/v1/admin/rate-plans/{id}/prices/{priceTierId}',
  '/api/v1/admin/coupons',
  '/api/v1/admin/coupons/{id}/disable',
  '/api/v1/admin/payments',
  '/api/v1/admin/payments/{paymentId}',
  '/api/v1/admin/payments/{paymentId}/reconcile',
];
for (const path of requiredAdminPaths) {
  const pathItem = pathItemFor(adminPaths, path);
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!method) continue;
    const responses = operation.responses;
    if (!responses?.['401'] || !responses['403']) {
      throw new Error(
        `Admin OpenAPI operation ${method.toUpperCase()} ${path} must document 401 and 403.`,
      );
    }
  }
}

const permittedAdminPaymentPaths = new Set([
  '/api/v1/admin/payment-providers',
  '/api/v1/admin/payment-providers/{provider}',
  '/api/v1/admin/payments',
  '/api/v1/admin/payments/{paymentId}',
  '/api/v1/admin/payments/{paymentId}/reconcile',
]);
for (const path of Object.keys(adminPaths)) {
  if (path.startsWith('/api/v1/public/')) {
    throw new Error(`admin-v1.json must not contain public route ${path}.`);
  }
  if (path.startsWith('/api/v1/availability') || path.startsWith('/api/v1/quotes')) {
    throw new Error(`admin-v1.json must not contain public route ${path}.`);
  }
  if (path.includes('/coupons/{id}/enable') || path.includes('/coupons/{id}/reactivate')) {
    throw new Error(`admin-v1.json must not expose coupon re-enable route ${path}.`);
  }
  if (
    (path.includes('/payment') ||
      path.includes('/momo') ||
      path.includes('/vnpay') ||
      path.includes('/ipn') ||
      path.includes('/webhook')) &&
    !permittedAdminPaymentPaths.has(path)
  ) {
    throw new Error(`admin-v1.json must not expose payment route ${path} in this phase.`);
  }
}

const ratePlanListPathItem = pathItemFor(adminPaths, '/api/v1/admin/rate-plans');
const ratePlanListOperation = ratePlanListPathItem.get;
if (!ratePlanListOperation) {
  throw new Error('admin-v1.json must declare GET /api/v1/admin/rate-plans.');
}
const listSchema = (
  ratePlanListOperation.responses?.['200'] as
    { content?: { 'application/json'?: { schema?: JsonObject } } } | undefined
)?.content?.['application/json']?.schema;
if (
  listSchema === undefined ||
  listSchema.type !== 'object' ||
  !('items' in (listSchema.properties as Record<string, unknown>))
) {
  throw new Error('Rate-plan list response must match the API { items } envelope.');
}

const adminResponses = admin.components?.responses;
if (!adminResponses) {
  throw new Error('admin-v1.json must define components.responses.');
}
for (const name of ['AuthenticationRequired', 'PermissionDenied', 'CatalogConflict']) {
  assertHasResponse(adminResponses, name, 'admin-v1.json');
}

for (const [path, pathItem] of Object.entries(adminPaths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!method || !operation) continue;
    assertEffectiveCookieAuth(
      operation,
      path,
      method as HttpMethod,
      'admin-v1.json',
      admin.security,
    );
  }
}

// --- public-v1.json -----------------------------------------------------------
const publicDoc = await parseArtifact(publicArtifactPath);
visitReferences(publicDoc);
const publicPaths = publicDoc.paths;
if (!publicPaths) {
  throw new Error('public-v1.json must define paths.');
}

const expectedPublicPaths = [
  '/api/v1/availability/search',
  '/api/v1/quotes',
  '/api/v1/quotes/{id}',
  '/api/v1/public/quotes/{quoteId}/bookings',
  '/api/v1/public/guest-access/otp/request',
  '/api/v1/public/guest-access/otp/verify',
  '/api/v1/public/bookings/{bookingCode}',
  '/api/v1/public/bookings/{bookingCode}/payments/momo/attempts',
  '/api/v1/public/bookings/{bookingCode}/payments/vnpay/attempts',
  '/api/v1/public/bookings/{bookingCode}/payment',
  '/api/v1/public/payment-providers',
  '/api/v1/webhooks/momo',
  '/api/v1/webhooks/vnpay',
  '/api/v1/payments/providers/momo/return',
  '/api/v1/payments/providers/vnpay/return',
  '/api/v1/public/booking-holds/status',
  '/api/v1/public/guest-access/logout',
];
for (const path of expectedPublicPaths) {
  if (!publicPaths[path]) throw new Error(`Missing required public OpenAPI path: ${path}`);
}
for (const path of Object.keys(publicPaths)) {
  if (path.startsWith('/api/v1/admin/')) {
    throw new Error(`public-v1.json must not contain admin route ${path}.`);
  }
  if (path.includes('/coupons/') && path.includes('/redeem')) {
    throw new Error(`public-v1.json must not expose public coupon redemption route ${path}.`);
  }
  const permittedPaymentPaths = new Set([
    '/api/v1/public/bookings/{bookingCode}/payments/momo/attempts',
    '/api/v1/webhooks/momo',
    '/api/v1/payments/providers/momo/return',
    '/api/v1/public/bookings/{bookingCode}/payments/vnpay/attempts',
    '/api/v1/public/bookings/{bookingCode}/payment',
    '/api/v1/public/payment-providers',
    '/api/v1/webhooks/vnpay',
    '/api/v1/payments/providers/vnpay/return',
  ]);
  if (
    (path.includes('/vnpay') ||
      path.includes('/ipn') ||
      ((path.includes('/payment') || path.includes('/momo') || path.includes('/webhook')) &&
        !permittedPaymentPaths.has(path))) &&
    !permittedPaymentPaths.has(path)
  ) {
    throw new Error(`public-v1.json must not expose unsupported payment route ${path}.`);
  }
}

const getBookingPathItem = pathItemFor(publicPaths, '/api/v1/public/bookings/{bookingCode}');
const getBookingOperation = getBookingPathItem.get;
if (!getBookingOperation) {
  throw new Error('public-v1.json must define GET /api/v1/public/bookings/{bookingCode}.');
}
const getBookingSecurity = getBookingOperation.security;
if (!getBookingSecurity || !getBookingSecurity.some((scheme) => 'cookieAuth' in scheme)) {
  throw new Error('GET /api/v1/public/bookings/{bookingCode} must declare cookieAuth security.');
}
const getBookingResponses = getBookingOperation.responses ?? {};
const forbiddenStatuses = Object.entries(getBookingResponses).filter(([status]) => {
  if (status === '401') {
    const ref = (getBookingResponses[status] as { $ref?: string } | undefined)?.$ref;
    return ref !== '#/components/responses/GuestSessionRequired';
  }
  return false;
});
if (forbiddenStatuses.length > 0) {
  throw new Error(
    `GET /api/v1/public/bookings/{bookingCode} may only document 401 via GuestSessionRequired.`,
  );
}

const publicResponses = publicDoc.components?.responses;
if (!publicResponses) {
  throw new Error('public-v1.json must define components.responses.');
}
for (const name of [
  'InvalidRequest',
  'QuoteCreationUnavailable',
  'QuoteUnavailable',
  'QuoteExpired',
  'BookingHoldConflict',
  'BookingHoldCleanupRetry',
  'OtpInvalidOrExpired',
  'OtpRateLimited',
  'GuestSessionRequired',
  'BookingNotFound',
]) {
  assertHasResponse(publicResponses, name, 'public-v1.json');
}
for (const name of ['AuthenticationRequired', 'PermissionDenied']) {
  if (publicResponses && publicResponses[name]) {
    throw new Error(`public-v1.json must not reference admin-only response ${name}.`);
  }
}
assertNoPublicRoomLeakageInPublic(publicDoc);

// --- cross-artifact operation ID uniqueness -----------------------------------
const adminIds = collectOperations(adminPaths);
const publicIds = collectOperations(publicPaths);
for (const id of adminIds.keys()) {
  if (publicIds.has(id)) {
    throw new Error(`operationId "${id}" appears in both admin-v1.json and public-v1.json.`);
  }
}

process.stdout.write(
  `OpenAPI references and required response components are valid (admin: ${adminIds.size} ops, public: ${publicIds.size} ops).\n`,
);
