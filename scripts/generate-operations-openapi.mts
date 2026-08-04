import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';

type Method = 'get' | 'patch' | 'post';
type Operation = Readonly<{
  method: Method;
  path: string;
  operationId: string;
  summary: string;
  sessionProbe?: boolean;
}>;

const artifactPath = resolve(import.meta.dirname, '../docs/openapi/operations-v1.json');
const operations: ReadonlyArray<Operation> = [
  {
    method: 'get',
    path: '/api/v1/admin/bookings',
    operationId: 'listAdminBookings',
    summary: 'List bookings for authorized operations staff.',
  },
  {
    method: 'get',
    path: '/api/v1/admin/bookings/{bookingCode}',
    operationId: 'getAdminBooking',
    summary: 'Read an operational booking detail.',
  },
  {
    method: 'post',
    path: '/api/v1/admin/bookings/{bookingCode}/cancel',
    operationId: 'cancelAdminBooking',
    summary: 'Cancel a booking through the authorized operational workflow.',
  },
  {
    method: 'post',
    path: '/api/v1/admin/bookings/{bookingCode}/check-in',
    operationId: 'checkInAdminBooking',
    summary: 'Check in a booking through the authorized operational workflow.',
  },
  {
    method: 'post',
    path: '/api/v1/admin/bookings/{bookingCode}/check-out',
    operationId: 'checkOutAdminBooking',
    summary: 'Check out a booking through the authorized operational workflow.',
  },
  {
    method: 'post',
    path: '/api/v1/admin/bookings/{bookingCode}/no-show',
    operationId: 'markAdminBookingNoShow',
    summary: 'Mark a booking as a no-show through the authorized operational workflow.',
  },
  {
    method: 'get',
    path: '/api/v1/admin/operational-reviews',
    operationId: 'listOperationalReviews',
    summary: 'List operational review records.',
  },
  {
    method: 'get',
    path: '/api/v1/admin/operational-reviews/{reviewId}',
    operationId: 'getOperationalReview',
    summary: 'Read one operational review record.',
  },
  {
    method: 'post',
    path: '/api/v1/admin/operational-reviews/{reviewId}/resolve',
    operationId: 'resolveOperationalReview',
    summary: 'Resolve an operational review with an authorized decision.',
  },
  {
    method: 'get',
    path: '/api/v1/admin/operational-report',
    operationId: 'getAdminOperationalReport',
    summary: 'Read server-aggregated operational metrics for the current property.',
  },
  {
    method: 'get',
    path: '/api/v1/admin/room-operations',
    operationId: 'listAdminRoomOperations',
    summary: 'Read physical-room occupancy, housekeeping and maintenance state from the server.',
  },
  {
    method: 'patch',
    path: '/api/v1/admin/rate-plans/{id}/selection-rule',
    operationId: 'updateRatePlanSelectionRule',
    summary: 'Update an authorized rate-plan selection rule.',
  },
  {
    method: 'post',
    path: '/api/v1/customer/bookings/{bookingCode}/claim',
    operationId: 'claimCustomerBooking',
    summary: 'Claim an eligible booking for the authenticated customer.',
  },
  {
    method: 'get',
    path: '/api/v1/customer/bookings',
    operationId: 'listCustomerBookings',
    summary: 'List bookings owned by the authenticated customer.',
  },
  {
    method: 'get',
    path: '/api/v1/customer/bookings/{bookingCode}',
    operationId: 'getCustomerBooking',
    summary: 'Read a booking owned by the authenticated customer.',
  },
  {
    method: 'post',
    path: '/api/v1/customer/bookings/{bookingCode}/cancellation-preview',
    operationId: 'previewCustomerBookingCancellation',
    summary: 'Preview cancellation eligibility and the server-calculated outcome.',
  },
  {
    method: 'post',
    path: '/api/v1/customer/bookings/{bookingCode}/alteration-preview',
    operationId: 'previewCustomerBookingAlteration',
    summary: 'Preview a booking alteration without mutating the existing booking.',
  },
  {
    method: 'get',
    path: '/api/v1/customer/bookings/{bookingCode}/access-pass',
    operationId: 'getCustomerBookingAccessPass',
    summary: 'Read a signed access pass for an owned confirmed booking.',
  },
  {
    method: 'post',
    path: '/api/v1/customer/bookings/{bookingCode}/payments/momo/attempts',
    operationId: 'initiateCustomerMomoPayment',
    summary: 'Start a MoMo payment attempt for an owned booking.',
  },
  {
    method: 'post',
    path: '/api/v1/customer/bookings/{bookingCode}/payments/vnpay/attempts',
    operationId: 'initiateCustomerVnpayPayment',
    summary: 'Start a VNPAY payment attempt for an owned booking.',
  },
  {
    method: 'get',
    path: '/api/v1/customer/bookings/{bookingCode}/payment',
    operationId: 'getCustomerPaymentStatus',
    summary: 'Read persisted payment status for an owned booking.',
  },
  {
    method: 'get',
    path: '/api/v1/customer/profile/session',
    operationId: 'getCustomerSessionStatus',
    summary: 'Read whether the current optional cookie belongs to an authenticated customer.',
    sessionProbe: true,
  },
  {
    method: 'get',
    path: '/api/v1/customer/profile',
    operationId: 'getCustomerProfile',
    summary: 'Read the authenticated customer profile.',
  },
  {
    method: 'patch',
    path: '/api/v1/customer/profile',
    operationId: 'updateCustomerProfile',
    summary: 'Update the authenticated customer profile.',
  },
];

const paths = operations.reduce<Record<string, Partial<Record<Method, unknown>>>>(
  (result, operation) => {
    const item = result[operation.path] ?? {};
    item[operation.method] = operation.sessionProbe
      ? {
          operationId: operation.operationId,
          summary: operation.summary,
          responses: {
            '200': {
              description: 'Session status resolved without exposing customer profile data.',
            },
          },
        }
      : {
          operationId: operation.operationId,
          summary: operation.summary,
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Authorized operation completed.' },
            '401': { description: 'Authentication is required.' },
            '403': {
              description: 'The authenticated actor is not permitted to perform this operation.',
            },
          },
        };
    result[operation.path] = item;
    return result;
  },
  {},
);

const document = {
  openapi: '3.1.1',
  info: {
    title: 'Room Management Customer and Operations API',
    version: '1.0.0',
    description: 'Authenticated customer self-service and operational booking endpoints.',
  },
  paths,
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'session' },
    },
  },
} as const;

const mode = process.argv[2];
const options = await resolveConfig(artifactPath);
const expected = await format(JSON.stringify(document), {
  ...options,
  filepath: artifactPath,
  parser: 'json',
});

if (mode === '--write') {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, expected, 'utf8');
  process.stdout.write(`Generated ${artifactPath}\n`);
} else if (mode === '--check') {
  const actual = await readFile(artifactPath, 'utf8').catch(() => undefined);
  if (actual !== expected) {
    throw new Error('Operations OpenAPI artifact is out of date. Run pnpm generate:openapi.');
  }
} else {
  throw new Error('Expected --write or --check.');
}
