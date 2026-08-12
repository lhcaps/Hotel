import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import type { ZodType } from '../packages/contracts/src/index.js';

interface NormalizedErrno {
  readonly code?: string;
}

import {
  adminCouponCreateSchema,
  adminBookingCouponDeliverySchema,
  adminBookingAccessPassScanRequestSchema,
  adminBookingAccessPassScanResponseSchema,
  adminAccountPatchSchema,
  adminAccountCreateSchema,
  adminAccountSchema,
  adminCustomerAccountPatchSchema,
  adminCustomerAccountSchema,
  adminAuditResponseSchema,
  adminDepartmentCommandSchema,
  adminDepartmentSchema,
  adminMeSchema,
  adminOperationalReportQuerySchema,
  adminOperationalReportSchema,
  adminRoomOperationsQuerySchema,
  adminRoomOperationsResponseSchema,
  adminPaymentDetailSchema,
  adminPaymentListQuerySchema,
  adminPaymentListResponseSchema,
  adminPaymentReconcileRequestSchema,
  adminPaymentReconcileResponseSchema,
  amenityCommandSchema,
  amenitySchema,
  amenityPatchSchema,
  archiveCommandSchema,
  assignAmenityCommandSchema,
  couponListSchema,
  couponDeliveryQueueResultSchema,
  couponSchema,
  housekeepingAssigneeSchema,
  housekeepingTaskActionSchema,
  housekeepingTaskAssignmentCommandSchema,
  housekeepingTaskAssignmentSchema,
  housekeepingTaskReopenCommandSchema,
  housekeepingTaskVersionCommandSchema,
  maintenanceBlockCommandSchema,
  maintenanceBlockSchema,
  priceTierCommandSchema,
  priceTierSchema,
  problemDetailsSchema,
  propertyCommandSchema,
  propertySchema,
  roomCommandSchema,
  roomHousekeepingCommandSchema,
  roomPatchSchema,
  roomSchema,
  roomTypeCommandSchema,
  roomTypePatchSchema,
  roomTypeSchema,
  ratePlanActivationSchema,
  ratePlanCreateCommandSchema,
  ratePlanPriceCommandSchema,
  ratePlanSchema,
  paymentProviderAdminSchema,
  paymentProviderUpdateSchema,
  z,
} from '../packages/contracts/src/index.js';

const artifactPath = resolve(import.meta.dirname, '../docs/openapi/admin-v1.json');
const jsonSchema = (schema: ZodType) => z.toJSONSchema(schema, { io: 'input' });

const document = {
  openapi: '3.1.1',
  info: {
    title: 'Room Management Admin API',
    version: '1.0.0',
    description:
      'Secure ADMIN-only catalog operations. Authentication uses HttpOnly session cookies. Public availability, quote, booking HOLD and guest-access routes are published separately in docs/openapi/public-v1.json.',
  },
  security: [{ cookieAuth: [] }],
  paths: {
    '/api/v1/admin/payment-providers': {
      get: {
        operationId: 'listAdminPaymentProviders',
        responses: {
          '200': {
            description: 'Non-secret payment provider settings.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/PaymentProviderAdmin' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/payment-providers/{provider}': {
      patch: {
        operationId: 'updateAdminPaymentProvider',
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { enum: ['MOMO', 'VNPAY'] } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaymentProviderUpdate' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated non-secret provider settings.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PaymentProviderAdmin' } },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/payments': {
      get: {
        operationId: 'listAdminPayments',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { $ref: '#/components/schemas/AdminPaymentListStatus' },
          },
          {
            name: 'provider',
            in: 'query',
            schema: { $ref: '#/components/schemas/AdminPaymentProviderFilter' },
          },
          {
            name: 'bookingCode',
            in: 'query',
            schema: { type: 'string', minLength: 1, maxLength: 64 },
          },
          { name: 'reviewRequired', in: 'query', schema: { type: 'boolean' } },
          { name: 'createdFrom', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'createdTo', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdminPaymentListQuery' } },
          },
        },
        responses: {
          '200': {
            description: 'Masked, safe payment summaries with bounded pagination.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminPaymentListResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/payments/{paymentId}': {
      get: {
        operationId: 'getAdminPaymentDetail',
        parameters: [
          {
            name: 'paymentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description:
              'Redacted payment detail including booking reference, masked attempts, masked provider refs, event timeline, reconciliation, audit and operational review.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminPaymentDetail' } },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/AdminPaymentNotFound' },
        },
      },
    },
    '/api/v1/admin/payments/{paymentId}/reconcile': {
      post: {
        operationId: 'reconcileAdminPayment',
        parameters: [
          {
            name: 'paymentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminPaymentReconcileRequest' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Triggers a provider query. The endpoint never fabricates a SUCCESS outcome and never mutates the payment status directly; only the provided reconciliation state is returned.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminPaymentReconcileResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/AdminPaymentNotFound' },
          '409': { $ref: '#/components/responses/AdminPaymentReconciliationConflict' },
          '429': { $ref: '#/components/responses/AdminPaymentReconciliationRateLimited' },
        },
      },
    },
    '/api/v1/admin/operational-report': {
      get: {
        operationId: 'getAdminOperationalReport',
        summary: 'Read server-aggregated operational metrics for the current property.',
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'bookingStatuses',
            in: 'query',
            schema: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminReportBookingStatus' },
            },
          },
          {
            name: 'paymentStatuses',
            in: 'query',
            schema: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdminReportPaymentStatus' },
            },
          },
          {
            name: 'ratePlanCodes',
            in: 'query',
            schema: { type: 'array', items: { type: 'string', maxLength: 64 } },
          },
          {
            name: 'roomTierCodes',
            in: 'query',
            schema: { type: 'array', items: { type: 'string', maxLength: 64 } },
          },
        ],
        responses: {
          '200': {
            description:
              'Property-scoped metrics aggregated on the server; outstanding revenue is null until partial payments are modeled.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminOperationalReport' },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '422': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/v1/admin/room-operations': {
      get: {
        operationId: 'listAdminRoomOperations',
        summary:
          'Read physical-room occupancy, housekeeping and maintenance state from the server.',
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' },
          },
        ],
        responses: {
          '200': {
            description: 'Property-scoped operational room rows.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminRoomOperationsResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '422': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/v1/admin/me': {
      get: {
        operationId: 'getAdminMe',
        responses: {
          '200': {
            description: 'Safe current administrator identity.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminMe' } },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/account-properties': {
      get: {
        operationId: 'listAssignableAdminProperties',
        summary: 'List active properties available when provisioning an administrator.',
        responses: {
          '200': {
            description: 'Active properties available to the SUPER_ADMIN actor.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Property' } },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/accounts': {
      get: {
        operationId: 'listAdminAccounts',
        responses: {
          '200': {
            description: 'Administrator accounts visible to the current administrator.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AdminAccount' } },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createAdminAccount',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdminAccountCreate' } },
          },
        },
        responses: {
          '200': {
            description: 'Administrator account created through the server-side auth authority.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminAccount' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/accounts/{id}': {
      patch: {
        operationId: 'updateAdminAccount',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdminAccountPatch' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated administrator account.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminAccount' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/admin/customer-accounts': {
      get: {
        operationId: 'listCustomerAccounts',
        responses: {
          '200': {
            description: 'Customer accounts with masked identity data and operational counts.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AdminCustomerAccount' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/customer-accounts/{id}': {
      patch: {
        operationId: 'updateCustomerAccount',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminCustomerAccountPatch' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated customer account.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminCustomerAccount' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/admin/customer-accounts/{id}/revoke-sessions': {
      post: {
        operationId: 'revokeCustomerSessions',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'All sessions for the customer were revoked.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'revokedSessions'],
                  properties: {
                    userId: { type: 'string', format: 'uuid' },
                    revokedSessions: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/admin/accounts/{id}/revoke-sessions': {
      post: {
        operationId: 'revokeAdminSessions',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'All sessions for the administrator were revoked.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'revokedSessions'],
                  properties: {
                    userId: { type: 'string', format: 'uuid' },
                    revokedSessions: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/admin/departments': {
      get: {
        operationId: 'listAdminDepartments',
        responses: {
          '200': {
            description: 'Administrator departments.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AdminDepartment' } },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createAdminDepartment',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminDepartmentCommand' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Created administrator department.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminDepartment' } },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/audit': {
      get: {
        operationId: 'listAdminAudit',
        responses: {
          '200': {
            description: 'Recent administrator audit events.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminAuditResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/property': {
      get: {
        operationId: 'getProperty',
        responses: {
          '200': {
            description: 'Current property.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Property' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      patch: {
        operationId: 'updateProperty',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PropertyCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated property.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Property' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/price-tiers': {
      get: {
        operationId: 'listPriceTiers',
        responses: {
          '200': { description: 'Deterministically ordered price tiers.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createPriceTier',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PriceTierCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Created price tier.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PriceTier' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/price-tiers/{id}': {
      patch: {
        operationId: 'updatePriceTier',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PriceTierCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated price tier.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PriceTier' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/price-tiers/{id}/archive': {
      post: {
        operationId: 'archivePriceTier',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ArchiveCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Archived price tier.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PriceTier' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/room-types': {
      get: {
        operationId: 'listRoomTypes',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': { description: 'Deterministically ordered room types.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createRoomType',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RoomTypeCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Created room type.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RoomType' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/room-types/{id}/archive': {
      post: {
        operationId: 'archiveRoomType',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ArchiveCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Archived room type.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RoomType' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/room-types/{id}/amenities': {
      post: {
        operationId: 'assignRoomTypeAmenity',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AssignAmenityCommand' } },
          },
        },
        responses: {
          '201': { description: 'Amenity assigned to room type.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/room-types/{id}/amenities/{amenityId}': {
      delete: {
        operationId: 'removeRoomTypeAmenity',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            name: 'amenityId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Removal result for the room-type / amenity pair.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    roomTypeId: { type: 'string', format: 'uuid' },
                    amenityId: { type: 'string', format: 'uuid' },
                    existed: { type: 'boolean' },
                  },
                  required: ['roomTypeId', 'amenityId', 'existed'],
                  additionalProperties: false,
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/room-types/{id}': {
      patch: {
        operationId: 'updateRoomType',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RoomTypePatch' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated room type.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RoomType' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
          '422': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/v1/admin/amenities/{id}': {
      patch: {
        operationId: 'updateAmenity',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AmenityPatch' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated amenity.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Amenity' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/rooms/{id}': {
      patch: {
        operationId: 'updateRoom',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RoomPatch' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated physical room.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/amenities': {
      get: {
        operationId: 'listAmenities',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': { description: 'Deterministically ordered amenities.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createAmenity',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AmenityCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Created amenity.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Amenity' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/amenities/{id}/archive': {
      post: {
        operationId: 'archiveAmenity',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ArchiveCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Archived amenity.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Amenity' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/rooms': {
      get: {
        operationId: 'listRooms',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': { description: 'Deterministically ordered physical rooms.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createRoom',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RoomCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Created physical room.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/rooms/{id}/archive': {
      post: {
        operationId: 'archiveRoom',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ArchiveCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Archived physical room.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/rooms/{id}/housekeeping': {
      patch: {
        operationId: 'updateRoomHousekeeping',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RoomHousekeepingCommand' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated internal housekeeping state for a physical room.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Room' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/rooms/{id}/housekeeping/assignment': {
      patch: {
        operationId: 'assignRoomHousekeepingTask',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HousekeepingTaskAssignmentCommand' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Assigned the current turnover task using its expected version.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HousekeepingTaskAssignment' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/housekeeping/assignees': {
      get: {
        operationId: 'listHousekeepingAssignees',
        summary: 'List active housekeeping staff scoped to the current property.',
        responses: {
          '200': {
            description: 'Assignable housekeeping staff in the active property.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/HousekeepingAssignee' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/rooms/{id}/housekeeping/verification': {
      patch: {
        operationId: 'verifyRoomHousekeepingTask',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HousekeepingTaskVersionCommand' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Verified the completed turnover task using its expected version.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HousekeepingTaskAction' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/rooms/{id}/housekeeping/reopen': {
      patch: {
        operationId: 'reopenRoomHousekeepingTask',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HousekeepingTaskReopenCommand' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Reopened a verified turnover task using its expected version.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HousekeepingTaskAction' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/maintenance-blocks': {
      get: {
        operationId: 'listMaintenanceBlocks',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': { description: 'Maintenance blocks ordered by start time.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createMaintenanceBlock',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MaintenanceBlockCommand' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Created maintenance block and inventory ledger allocation.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MaintenanceBlock' } },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/maintenance-blocks/{id}/cancel': {
      post: {
        operationId: 'cancelMaintenanceBlock',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Cancelled maintenance block and released inventory allocation.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MaintenanceBlock' } },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/rate-plans': {
      get: {
        operationId: 'listRatePlans',
        responses: {
          '200': {
            description: 'Rate plans with a price entry for every active price tier.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/RatePlan' } },
                  },
                  required: ['items'],
                  additionalProperties: false,
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createRatePlan',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RatePlanCreateCommand' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created rate plan in DRAFT status.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RatePlan' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/rate-plans/{id}/prices/{priceTierId}': {
      put: {
        operationId: 'setRatePlanPrice',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            name: 'priceTierId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RatePlanPriceCommand' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated rate-plan price. The endpoint returns no response body.',
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
      patch: {
        operationId: 'patchRatePlanPrice',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          {
            name: 'priceTierId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RatePlanPriceCommand' } },
          },
        },
        responses: {
          '200': { description: 'Updated rate-plan price. The endpoint returns no response body.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/rate-plans/{id}/activate': {
      post: {
        operationId: 'activateRatePlan',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RatePlanActivation' } },
          },
        },
        responses: {
          '200': {
            description: 'Activated fully configured rate plan.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RatePlan' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/rate-plans/{id}/inactivate': {
      post: {
        operationId: 'inactivateRatePlan',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Inactivated rate plan.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RatePlan' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/pricing-policies': {
      get: {
        operationId: 'listPricingPolicies',
        responses: {
          '200': {
            description: 'Server-owned pricing policy releases for the current property.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    propertyId: { type: 'string', format: 'uuid' },
                    releases: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PricingPolicyHeader' },
                    },
                  },
                  required: ['propertyId', 'releases'],
                  additionalProperties: false,
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
      post: {
        operationId: 'createPricingPolicyDraft',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PricingPolicyDraftCommand' },
            },
          },
        },
        responses: {
          '200': { description: 'Created a DRAFT pricing policy.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { description: 'Draft creation conflicts with the current property lineage.' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
    },
    '/api/v1/admin/pricing-policies/bootstrap': {
      post: {
        operationId: 'bootstrapPricingPolicyDraft',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PricingPolicyBootstrapCommand' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Previewed or created a B0 DRAFT from explicit V1 technical plans.',
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { description: 'The V1 bootstrap source or aggregate is invalid.' },
          '503': { description: 'Bootstrap is disabled outside the explicit development gate.' },
        },
      },
    },
    '/api/v1/admin/pricing-policies/{id}': {
      get: {
        operationId: 'getPricingPolicy',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Complete policy aggregate.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PricingPolicyAggregate' },
              },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
      patch: {
        operationId: 'updatePricingPolicyDraft',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PricingPolicyAggregateUpdate' },
            },
          },
        },
        responses: {
          '200': { description: 'Updated a DRAFT policy aggregate.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { description: 'The draft is stale, immutable, or not publication-ready.' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
    },
    '/api/v1/admin/pricing-policies/{id}/preview': {
      post: {
        operationId: 'previewPricingPolicy',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Mutation-free aggregate validation preview.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PricingPolicyPreview' } },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/NotFound' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
    },
    '/api/v1/admin/pricing-policies/{id}/cancel': {
      post: {
        operationId: 'cancelPricingPolicyDraft',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', minLength: 1, maxLength: 500 } },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          '200': { description: 'Cancelled a DRAFT policy.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { description: 'Published policy cancellation is forbidden.' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
    },
    '/api/v1/admin/pricing-policies/{id}/publish': {
      post: {
        operationId: 'publishPricingPolicy',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idempotencyKey'],
                properties: { idempotencyKey: { type: 'string', minLength: 8, maxLength: 160 } },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          '200': { description: 'Published an initially valid DRAFT policy.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { description: 'Publication validation or lineage conflict.' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
    },
    '/api/v1/admin/pricing-policies/{predecessorId}/supersede': {
      post: {
        operationId: 'schedulePricingPolicySupersession',
        parameters: [
          {
            name: 'predecessorId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PricingPolicySupersessionCommand' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Published the successor at the exact cutover and closed the predecessor interval.',
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { description: 'Supersession interval, basis, or aggregate conflict.' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
    },
    '/api/v1/admin/pricing-policies/{id}/retire': {
      post: {
        operationId: 'retirePricingPolicy',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Retired an ended PUBLISHED policy.' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { description: 'Policy is not ended or is not PUBLISHED.' },
          '503': { description: 'The server-owned catalog runtime gate is closed.' },
        },
      },
    },
    '/api/v1/admin/coupons': {
      get: {
        operationId: 'listCoupons',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Coupons ordered by creation time.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CouponList' } },
            },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
      post: {
        operationId: 'createCoupon',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminCouponCreate' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Created coupon.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Coupon' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/CatalogConflict' },
        },
      },
    },
    '/api/v1/admin/coupons/{id}': {
      get: {
        operationId: 'getCoupon',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Coupon detail with derived lifecycle and aggregate counts.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Coupon' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/coupons/{id}/disable': {
      post: {
        operationId: 'disableCoupon',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Disabled coupon. Existing reservations remain valid.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Coupon' } } },
          },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
        },
      },
    },
    '/api/v1/admin/bookings/{bookingCode}/send-coupons': {
      post: {
        operationId: 'queueAdminBookingCouponDelivery',
        parameters: [
          {
            name: 'bookingCode',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[A-Z0-9-]{4,32}$' },
          },
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', minLength: 16, maxLength: 128 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminBookingCouponDelivery' },
            },
          },
        },
        responses: {
          '201': {
            description:
              'An idempotent transactional-outbox request; no coupon lifecycle state changes.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CouponDeliveryQueueResult' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '404': { $ref: '#/components/responses/CouponDeliveryBookingNotFound' },
          '409': { $ref: '#/components/responses/CouponDeliveryConflict' },
        },
      },
    },
    '/api/v1/admin/booking-access-passes/scan': {
      post: {
        operationId: 'scanAdminBookingAccessPass',
        summary: 'Verify a signed booking access pass and return the next ADMIN lifecycle action.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminBookingAccessPassScanRequest' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'A token-free booking preview. Check-in and check-out remain separate ADMIN-confirmed actions.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminBookingAccessPassScanResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/AuthenticationRequired' },
          '403': { $ref: '#/components/responses/PermissionDenied' },
          '409': { $ref: '#/components/responses/BookingAccessPassInvalid' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'rm_admin_session_v1',
        description:
          'HttpOnly, SameSite=Lax, Secure-in-production administrator session cookie. The raw token is never returned in any JSON body.',
      },
    },
    schemas: {
      AdminBookingCouponDelivery: jsonSchema(adminBookingCouponDeliverySchema),
      AdminBookingAccessPassScanRequest: jsonSchema(adminBookingAccessPassScanRequestSchema),
      AdminBookingAccessPassScanResponse: jsonSchema(adminBookingAccessPassScanResponseSchema),
      AdminCouponCreate: jsonSchema(adminCouponCreateSchema),
      AdminMe: jsonSchema(adminMeSchema),
      Amenity: jsonSchema(amenitySchema),
      AmenityCommand: jsonSchema(amenityCommandSchema),
      AmenityPatch: jsonSchema(amenityPatchSchema),
      ArchiveCommand: jsonSchema(archiveCommandSchema),
      AssignAmenityCommand: jsonSchema(assignAmenityCommandSchema),
      Coupon: jsonSchema(couponSchema),
      CouponDeliveryQueueResult: jsonSchema(couponDeliveryQueueResultSchema),
      CouponList: jsonSchema(couponListSchema),
      MaintenanceBlock: jsonSchema(maintenanceBlockSchema),
      MaintenanceBlockCommand: jsonSchema(maintenanceBlockCommandSchema),
      PriceTier: jsonSchema(priceTierSchema),
      PriceTierCommand: jsonSchema(priceTierCommandSchema),
      ProblemDetails: jsonSchema(problemDetailsSchema),
      Property: jsonSchema(propertySchema),
      PropertyCommand: jsonSchema(propertyCommandSchema),
      Room: jsonSchema(roomSchema),
      RoomCommand: jsonSchema(roomCommandSchema),
      RoomHousekeepingCommand: jsonSchema(roomHousekeepingCommandSchema),
      HousekeepingAssignee: jsonSchema(housekeepingAssigneeSchema),
      HousekeepingTaskAction: jsonSchema(housekeepingTaskActionSchema),
      HousekeepingTaskAssignment: jsonSchema(housekeepingTaskAssignmentSchema),
      HousekeepingTaskAssignmentCommand: jsonSchema(housekeepingTaskAssignmentCommandSchema),
      HousekeepingTaskReopenCommand: jsonSchema(housekeepingTaskReopenCommandSchema),
      HousekeepingTaskVersionCommand: jsonSchema(housekeepingTaskVersionCommandSchema),
      RoomPatch: jsonSchema(roomPatchSchema),
      RoomType: jsonSchema(roomTypeSchema),
      RoomTypeCommand: jsonSchema(roomTypeCommandSchema),
      RoomTypePatch: jsonSchema(roomTypePatchSchema),
      RatePlan: jsonSchema(ratePlanSchema),
      RatePlanActivation: jsonSchema(ratePlanActivationSchema),
      RatePlanCreateCommand: jsonSchema(ratePlanCreateCommandSchema),
      RatePlanPriceCommand: jsonSchema(ratePlanPriceCommandSchema),
      PaymentProviderAdmin: jsonSchema(paymentProviderAdminSchema),
      PaymentProviderUpdate: jsonSchema(paymentProviderUpdateSchema),
      AdminPaymentDetail: jsonSchema(adminPaymentDetailSchema),
      AdminAccount: jsonSchema(adminAccountSchema),
      AdminAccountPatch: jsonSchema(adminAccountPatchSchema),
      AdminAccountCreate: jsonSchema(adminAccountCreateSchema),
      AdminCustomerAccount: jsonSchema(adminCustomerAccountSchema),
      AdminCustomerAccountPatch: jsonSchema(adminCustomerAccountPatchSchema),
      AdminAuditResponse: jsonSchema(adminAuditResponseSchema),
      AdminDepartment: jsonSchema(adminDepartmentSchema),
      AdminDepartmentCommand: jsonSchema(adminDepartmentCommandSchema),
      AdminPaymentListQuery: jsonSchema(adminPaymentListQuerySchema),
      AdminPaymentListResponse: jsonSchema(adminPaymentListResponseSchema),
      AdminPaymentListStatus: jsonSchema(
        z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REVIEW_REQUIRED']),
      ),
      AdminPaymentProviderFilter: jsonSchema(z.enum(['MOMO', 'VNPAY'])),
      AdminPaymentReconcileRequest: jsonSchema(adminPaymentReconcileRequestSchema),
      AdminPaymentReconcileResponse: jsonSchema(adminPaymentReconcileResponseSchema),
      AdminOperationalReportQuery: jsonSchema(adminOperationalReportQuerySchema),
      AdminOperationalReport: jsonSchema(adminOperationalReportSchema),
      AdminRoomOperationsQuery: jsonSchema(adminRoomOperationsQuerySchema),
      AdminRoomOperationsResponse: jsonSchema(adminRoomOperationsResponseSchema),
      AdminReportBookingStatus: jsonSchema(
        z.enum([
          'HOLD',
          'CONFIRMED',
          'EXPIRED',
          'CANCELLED',
          'NO_SHOW',
          'CHECKED_IN',
          'CHECKED_OUT',
        ]),
      ),
      AdminReportPaymentStatus: jsonSchema(
        z.enum(['NONE', 'PENDING', 'SUCCEEDED', 'REVIEW_REQUIRED', 'CANCELLED', 'EXPIRED']),
      ),
      PricingPolicyHeader: {
        type: 'object',
        additionalProperties: true,
      },
      PricingPolicyDraftCommand: {
        type: 'object',
        additionalProperties: true,
      },
      PricingPolicyBootstrapCommand: {
        type: 'object',
        additionalProperties: true,
      },
      PricingPolicyAggregate: {
        type: 'object',
        additionalProperties: true,
      },
      PricingPolicyAggregateUpdate: {
        type: 'object',
        additionalProperties: true,
      },
      PricingPolicyPreview: {
        type: 'object',
        additionalProperties: true,
      },
      PricingPolicySupersessionCommand: {
        type: 'object',
        additionalProperties: true,
      },
    },
    responses: {
      ValidationError: {
        description: 'The request body or idempotency key is invalid.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      NotFound: {
        description: 'The requested resource does not exist.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      AuthenticationRequired: {
        description: 'A valid active ADMIN session is required.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      PermissionDenied: {
        description: 'The current session lacks a required permission.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      CatalogConflict: {
        description: 'The requested catalog mutation conflicts with existing data.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      BookingAccessPassInvalid: {
        description: 'The booking access pass is invalid, expired, revoked, or not actionable.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      CouponDeliveryBookingNotFound: {
        description: 'No booking contact exists for the specified booking code.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      CouponDeliveryConflict: {
        description:
          'Coupon availability changed or the idempotency key was reused with a different request.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      AdminPaymentNotFound: {
        description: 'No payment exists for the requested id within the active property scope.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      AdminPaymentReconciliationConflict: {
        description:
          'The reconciliation request was rejected because the payment state changed since the request was prepared (expectedAttemptId / expectedUpdatedAt mismatch).',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
      AdminPaymentReconciliationRateLimited: {
        description:
          'The reconciliation request was rate limited by the provider adapter; retry after the provided timestamp.',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      },
    },
  },
} as const;

const mode = process.argv[2];
const prettierOptions = await resolveConfig(artifactPath);
const expected = await format(JSON.stringify(document), {
  ...prettierOptions,
  filepath: artifactPath,
  parser: 'json',
});

if (mode === '--write') {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, expected, 'utf8');
  process.stdout.write(`Generated ${artifactPath}\n`);
} else if (mode === '--check') {
  let actual: string | undefined;
  try {
    actual = await readFile(artifactPath, 'utf8');
  } catch (error: unknown) {
    if ((error as NormalizedErrno).code !== 'ENOENT') throw error;
  }
  if (actual !== expected) {
    process.stderr.write('Admin OpenAPI artifact is out of date. Run pnpm generate:openapi.\n');
    process.exitCode = 1;
  }
} else {
  throw new Error('Expected --write or --check.');
}
