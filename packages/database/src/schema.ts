import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const moneyVnd = (name: string) => bigint(name, { mode: 'bigint' });
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const catalogStatus = pgEnum('catalog_status', ['ACTIVE', 'INACTIVE']);
export const roomStatus = pgEnum('room_status', ['ACTIVE', 'INACTIVE', 'MAINTENANCE']);
export const housekeepingStatus = pgEnum('housekeeping_status', ['CLEAN', 'DIRTY', 'CLEANING']);
export const housekeepingTaskType = pgEnum('housekeeping_task_type', ['ARRIVAL_PREP', 'TURNOVER']);
export const housekeepingTaskStatus = pgEnum('housekeeping_task_status', [
  'SCHEDULED',
  'DUE',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
]);
export const ratePlanStatus = pgEnum('rate_plan_status', ['DRAFT', 'ACTIVE', 'INACTIVE']);
export const bookingStatus = pgEnum('booking_status', [
  'HOLD',
  'CONFIRMED',
  'EXPIRED',
  'CANCELLED',
  'NO_SHOW',
  'CHECKED_IN',
  'CHECKED_OUT',
]);
export const maintenanceBlockStatus = pgEnum('maintenance_block_status', ['ACTIVE', 'CANCELLED']);
export const inventoryBlockType = pgEnum('inventory_block_type', ['BOOKING', 'MAINTENANCE']);
export const inventoryBlockStatus = pgEnum('inventory_block_status', ['ACTIVE', 'RELEASED']);
export const accessCredentialProvider = pgEnum('access_credential_provider', ['DEMO']);
export const accessCredentialStatus = pgEnum('access_credential_status', [
  'PENDING',
  'ISSUED',
  'DELIVERED',
  'REVOKED',
  'FAILED',
]);
export const auditActorType = pgEnum('audit_actor_type', ['GUEST', 'CUSTOMER', 'ADMIN', 'SYSTEM']);
export const outboxStatus = pgEnum('outbox_status', ['PENDING', 'PUBLISHED', 'FAILED']);
export const userRole = pgEnum('user_role', [
  'ADMIN',
  'SUPER_ADMIN',
  'ROOM_STATUS_VIEWER',
  'CUSTOMER',
]);
export const adminRole = pgEnum('admin_role', [
  'ADMIN',
  'SUPER_ADMIN',
  'ROOM_STATUS_VIEWER',
  'OPERATIONS_MANAGER',
  'HOUSEKEEPING_MANAGER',
  'HOUSEKEEPING_STAFF',
  'PAYMENT_STAFF',
  'MAINTENANCE_MANAGER',
  'MAINTENANCE_STAFF',
]);
export const adminMembershipStatus = pgEnum('admin_membership_status', ['ACTIVE', 'REVOKED']);
export const userStatus = pgEnum('user_status', ['ACTIVE', 'DISABLED']);
export const couponStatus = pgEnum('coupon_status', ['ACTIVE', 'DISABLED']);
export const couponDiscountType = pgEnum('coupon_discount_type', ['FIXED', 'PERCENTAGE']);
export const couponApplicationStatus = pgEnum('coupon_application_status', [
  'ASSOCIATED',
  'RESERVED',
  'REDEEMED',
  'RELEASED',
]);
export const paymentProvider = pgEnum('payment_provider', ['MOMO', 'VNPAY']);
export const paymentStatus = pgEnum('payment_status', [
  'PENDING',
  'SUCCEEDED',
  'REVIEW_REQUIRED',
  'CANCELLED',
  'EXPIRED',
]);
export const paymentAttemptStatus = pgEnum('payment_attempt_status', [
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REVIEW_REQUIRED',
]);
export const paymentEventProcessingStatus = pgEnum('payment_event_processing_status', [
  'PROCESSED',
  'DUPLICATE',
  'REJECTED',
  'REVIEW_REQUIRED',
]);
export const paymentNormalizedOutcome = pgEnum('payment_normalized_outcome', [
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
]);
export const paymentConfirmationSource = pgEnum('payment_confirmation_source', [
  'PROVIDER_EVENT',
  'NO_CHARGE',
]);
export const operationalReviewCategory = pgEnum('operational_review_category', [
  'PAID_CANCELLATION',
]);
export const operationalReviewStatus = pgEnum('operational_review_status', ['OPEN', 'RESOLVED']);
export const pricingPolicyVersionStatus = pgEnum('pricing_policy_version_status', [
  'DRAFT',
  'PUBLISHED',
  'RETIRED',
  'CANCELLED',
]);
export const pricingPolicyApplicabilityBasis = pgEnum('pricing_policy_applicability_basis', [
  'QUOTE_INSTANT',
  'STAY_START',
]);
export const pricingPolicyComponentKind = pgEnum('pricing_policy_component_kind', [
  'BASE_STAY',
  'EXTENSION',
]);
export const pricingPolicyCoverageModel = pgEnum('pricing_policy_coverage_model', [
  'FIXED_ELAPSED',
  'LOCAL_CLOCK_WINDOW',
  'REQUEST_BOUNDARY',
]);
export const pricingPolicyBillingModel = pgEnum('pricing_policy_billing_model', [
  'FIXED_OCCURRENCE',
  'STARTED_UNIT',
]);
export const pricingPolicyBoundaryPosition = pgEnum('pricing_policy_boundary_position', [
  'LEADING',
  'TRAILING',
]);

export const schemaMetadata = pgTable(
  'schema_metadata',
  {
    id: integer('id').primaryKey().default(1),
    schemaVersion: text('schema_version').notNull(),
    appliedAt: timestamptz('applied_at').notNull().defaultNow(),
  },
  (table) => [check('schema_metadata_singleton_ck', sql`${table.id} = 1`)],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: userRole('role').notNull().default('CUSTOMER'),
    status: userStatus('status').notNull().default('ACTIVE'),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    banExpires: timestamptz('ban_expires'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_ci_uq').on(sql`lower(${table.email})`),
    check('users_email_nonempty_ck', sql`btrim(${table.email}) <> ''`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamptz('expires_at').notNull(),
    token: text('token').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'),
    userId: uuid('user_id').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'sessions_user_fk',
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    uniqueIndex('sessions_token_uq').on(table.token),
    index('sessions_user_expires_idx').on(table.userId, table.expiresAt),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamptz('access_token_expires_at'),
    refreshTokenExpiresAt: timestamptz('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'accounts_user_fk',
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    uniqueIndex('accounts_provider_account_uq').on(table.providerId, table.accountId),
  ],
);

export const adminDepartments = pgTable(
  'admin_departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: catalogStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('admin_departments_code_uq').on(sql`upper(${table.code})`),
    check('admin_departments_code_nonempty_ck', sql`btrim(${table.code}) <> ''`),
    check('admin_departments_name_nonempty_ck', sql`btrim(${table.name}) <> ''`),
  ],
);

export const adminProfiles = pgTable(
  'admin_profiles',
  {
    userId: uuid('user_id').primaryKey(),
    jobTitle: text('job_title'),
    phone: text('phone'),
    notes: text('notes'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'admin_profiles_user_fk',
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
  ],
);

export const adminMemberships = pgTable(
  'admin_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    departmentId: uuid('department_id').notNull(),
    role: adminRole('role').notNull(),
    status: adminMembershipStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    revokedAt: timestamptz('revoked_at'),
  },
  (table) => [
    foreignKey({
      name: 'admin_memberships_user_fk',
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'admin_memberships_department_fk',
      columns: [table.departmentId],
      foreignColumns: [adminDepartments.id],
    }).onDelete('restrict'),
    uniqueIndex('admin_memberships_user_department_uq').on(table.userId, table.departmentId),
    index('admin_memberships_user_status_idx').on(table.userId, table.status),
    check(
      'admin_memberships_revoked_at_ck',
      sql`(${table.status} = 'ACTIVE' AND ${table.revokedAt} IS NULL)
          OR (${table.status} = 'REVOKED' AND ${table.revokedAt} IS NOT NULL)`,
    ),
  ],
);

export const verificationRecords = pgTable(
  'verification_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('verification_records_identifier_value_uq').on(table.identifier, table.value),
  ],
);

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),
    minimumStayMinutes: integer('minimum_stay_minutes').notNull().default(60),
    maximumStayMinutes: integer('maximum_stay_minutes').notNull().default(10_080),
    minimumLeadTimeMinutes: integer('minimum_lead_time_minutes').notNull().default(0),
    maximumAdvanceBookingDays: integer('maximum_advance_booking_days').notNull().default(365),
    defaultOvernightDurationMinutes: integer('default_overnight_duration_minutes')
      .notNull()
      .default(720),
    status: catalogStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('properties_code_uq').on(table.code),
    check('properties_code_nonempty_ck', sql`btrim(${table.code}) <> ''`),
    check('properties_name_nonempty_ck', sql`btrim(${table.name}) <> ''`),
    check(
      'properties_stay_policy_ck',
      sql`${table.minimumStayMinutes} >= 1
        AND ${table.maximumStayMinutes} >= ${table.minimumStayMinutes}
        AND ${table.maximumStayMinutes} <= 44640
        AND ${table.minimumLeadTimeMinutes} >= 0
        AND ${table.maximumAdvanceBookingDays} >= 0
        AND ${table.defaultOvernightDurationMinutes} >= 1
        AND ${table.defaultOvernightDurationMinutes} <= ${table.maximumStayMinutes}`,
    ),
  ],
);

// Explicit per-property authorization scope for admin users.
// property_id = NULL means explicit ALL-PROPERTY authority (still a deliberate row).
// SUPER_ADMIN derives global authority from ROLE_PERMISSIONS, not from rows here.
export const adminPropertyMemberships = pgTable(
  'admin_property_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    // null = all-property explicit grant
    propertyId: uuid('property_id'),
    status: adminMembershipStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    revokedAt: timestamptz('revoked_at'),
  },
  (table) => [
    foreignKey({
      name: 'admin_property_memberships_user_fk',
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'admin_property_memberships_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    // One active row per (user, property) including the ALL-PROPERTY (NULL) row.
    // COALESCE uses the nil UUID as a stable surrogate for NULL in the unique predicate.
    uniqueIndex('admin_property_memberships_user_property_active_uq')
      .on(
        table.userId,
        sql`COALESCE(${table.propertyId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`${table.status} = 'ACTIVE'`),
    index('admin_property_memberships_user_status_idx').on(table.userId, table.status),
    check(
      'admin_property_memberships_revoked_at_ck',
      sql`(${table.status} = 'ACTIVE' AND ${table.revokedAt} IS NULL)
          OR (${table.status} = 'REVOKED' AND ${table.revokedAt} IS NOT NULL)`,
    ),
  ],
);

export const priceTiers = pgTable(
  'price_tiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    status: catalogStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'price_tiers_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    unique('price_tiers_property_id_id_uq').on(table.propertyId, table.id),
    uniqueIndex('price_tiers_property_code_uq').on(table.propertyId, table.code),
    check('price_tiers_code_nonempty_ck', sql`btrim(${table.code}) <> ''`),
    check('price_tiers_name_nonempty_ck', sql`btrim(${table.name}) <> ''`),
    check('price_tiers_sort_order_nonnegative_ck', sql`${table.sortOrder} >= 0`),
  ],
);

export const roomTypes = pgTable(
  'room_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    priceTierId: uuid('price_tier_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    maxAdults: integer('max_adults').notNull(),
    maxChildren: integer('max_children').notNull().default(0),
    maxOccupancy: integer('max_occupancy').notNull(),
    status: catalogStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'room_types_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'room_types_property_price_tier_fk',
      columns: [table.propertyId, table.priceTierId],
      foreignColumns: [priceTiers.propertyId, priceTiers.id],
    }).onDelete('restrict'),
    unique('room_types_property_id_id_uq').on(table.propertyId, table.id),
    uniqueIndex('room_types_property_code_uq').on(table.propertyId, table.code),
    check('room_types_code_nonempty_ck', sql`btrim(${table.code}) <> ''`),
    check(
      'room_types_capacity_ck',
      sql`
      ${table.maxAdults} >= 1
      AND ${table.maxChildren} >= 0
      AND ${table.maxOccupancy} >= ${table.maxAdults}
      AND ${table.maxOccupancy} >= ${table.maxChildren}
      AND ${table.maxOccupancy} <= ${table.maxAdults} + ${table.maxChildren}
    `,
    ),
  ],
);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    roomTypeId: uuid('room_type_id').notNull(),
    roomNumber: text('room_number').notNull(),
    physicalRoomCode: text('physical_room_code').notNull(),
    status: roomStatus('status').notNull().default('ACTIVE'),
    housekeepingStatus: housekeepingStatus('housekeeping_status').notNull().default('CLEAN'),
    notes: text('notes'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'rooms_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'rooms_property_room_type_fk',
      columns: [table.propertyId, table.roomTypeId],
      foreignColumns: [roomTypes.propertyId, roomTypes.id],
    }).onDelete('restrict'),
    unique('rooms_property_id_uq').on(table.propertyId, table.id),
    unique('rooms_property_room_type_id_uq').on(table.propertyId, table.roomTypeId, table.id),
    uniqueIndex('rooms_property_room_number_uq').on(table.propertyId, table.roomNumber),
    uniqueIndex('rooms_property_physical_room_code_uq').on(
      table.propertyId,
      table.physicalRoomCode,
    ),
    check('rooms_number_nonempty_ck', sql`btrim(${table.roomNumber}) <> ''`),
    check('rooms_physical_room_code_nonempty_ck', sql`btrim(${table.physicalRoomCode}) <> ''`),
    check(
      'rooms_notes_trimmed_ck',
      sql`${table.notes} IS NULL OR btrim(${table.notes}) = ${table.notes}`,
    ),
    check('rooms_notes_length_ck', sql`${table.notes} IS NULL OR length(${table.notes}) <= 2000`),
  ],
);

export const amenities = pgTable(
  'amenities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: catalogStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'amenities_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    unique('amenities_property_id_id_uq').on(table.propertyId, table.id),
    uniqueIndex('amenities_property_code_uq').on(table.propertyId, table.code),
    check('amenities_code_nonempty_ck', sql`btrim(${table.code}) <> ''`),
    check('amenities_name_nonempty_ck', sql`btrim(${table.name}) <> ''`),
  ],
);

export const roomTypeAmenities = pgTable(
  'room_type_amenities',
  {
    propertyId: uuid('property_id').notNull(),
    roomTypeId: uuid('room_type_id').notNull(),
    amenityId: uuid('amenity_id').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'room_type_amenities_pk',
      columns: [table.propertyId, table.roomTypeId, table.amenityId],
    }),
    foreignKey({
      name: 'room_type_amenities_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'room_type_amenities_room_type_fk',
      columns: [table.propertyId, table.roomTypeId],
      foreignColumns: [roomTypes.propertyId, roomTypes.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'room_type_amenities_amenity_fk',
      columns: [table.propertyId, table.amenityId],
      foreignColumns: [amenities.propertyId, amenities.id],
    }).onDelete('restrict'),
  ],
);

export const ratePlans = pgTable(
  'rate_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: ratePlanStatus('status').notNull().default('DRAFT'),
    includedDurationMinutes: integer('included_duration_minutes').notNull(),
    priority: integer('priority').notNull(),
    isBasePlan: boolean('is_base_plan').notNull().default(true),
    minCheckInMinuteInclusive: integer('min_check_in_minute_inclusive'),
    maxCheckInMinuteExclusive: integer('max_check_in_minute_exclusive'),
    minDurationMinutesInclusive: integer('min_duration_minutes_inclusive'),
    maxDurationMinutesInclusive: integer('max_duration_minutes_inclusive'),
    sourceEvidence: text('source_evidence').notNull().default('Phase 0 pricing rules'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'rate_plans_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    unique('rate_plans_property_id_id_uq').on(table.propertyId, table.id),
    uniqueIndex('rate_plans_property_code_uq').on(table.propertyId, table.code),
    check('rate_plans_code_format_ck', sql`${table.code} ~ '^[A-Z0-9_]{1,64}$'`),
    check(
      'rate_plans_duration_ck',
      sql`${table.includedDurationMinutes} >= 60 AND ${table.includedDurationMinutes} <= 1440
          AND ${table.includedDurationMinutes} % 15 = 0`,
    ),
    check('rate_plans_priority_ck', sql`${table.priority} >= 0 AND ${table.priority} <= 1000`),
    check(
      'rate_plans_is_base_plan_ck',
      sql`(${table.code} = 'EXTRA_HOUR' AND ${table.isBasePlan} = false)
          OR (${table.code} <> 'EXTRA_HOUR' AND ${table.isBasePlan} = true)`,
    ),
    check(
      'rate_plans_check_in_window_pair_ck',
      sql`(${table.minCheckInMinuteInclusive} IS NULL AND ${table.maxCheckInMinuteExclusive} IS NULL)
          OR (${table.minCheckInMinuteInclusive} IS NOT NULL AND ${table.maxCheckInMinuteExclusive} IS NOT NULL)`,
    ),
    check(
      'rate_plans_check_in_window_range_ck',
      sql`${table.minCheckInMinuteInclusive} IS NULL
          OR (${table.minCheckInMinuteInclusive} >= 0
              AND ${table.minCheckInMinuteInclusive} <= 1425
              AND ${table.minCheckInMinuteInclusive} % 15 = 0)`,
    ),
    check(
      'rate_plans_check_in_window_max_ck',
      sql`${table.maxCheckInMinuteExclusive} IS NULL
          OR (${table.maxCheckInMinuteExclusive} >= 15
              AND ${table.maxCheckInMinuteExclusive} <= 1440
              AND ${table.maxCheckInMinuteExclusive} % 15 = 0)`,
    ),
    check(
      'rate_plans_check_in_window_order_ck',
      sql`${table.minCheckInMinuteInclusive} IS NULL
          OR ${table.maxCheckInMinuteExclusive} IS NULL
          OR ${table.maxCheckInMinuteExclusive} > ${table.minCheckInMinuteInclusive}`,
    ),
    check(
      'rate_plans_check_in_window_cross_midnight_ck',
      sql`${table.minCheckInMinuteInclusive} IS NULL
          OR ${table.maxCheckInMinuteExclusive} IS NULL
          OR ${table.minCheckInMinuteInclusive} < 1440`,
    ),
    check(
      'rate_plans_base_plan_duration_window_ck',
      sql`${table.isBasePlan} = false
          OR (${table.minDurationMinutesInclusive} IS NOT NULL
              AND ${table.maxDurationMinutesInclusive} IS NOT NULL
              AND ${table.minDurationMinutesInclusive} >= 60
              AND ${table.minDurationMinutesInclusive} <= 1440
              AND ${table.minDurationMinutesInclusive} % 15 = 0
              AND ${table.maxDurationMinutesInclusive} >= 60
              AND ${table.maxDurationMinutesInclusive} <= 1440
              AND ${table.maxDurationMinutesInclusive} % 15 = 0
              AND ${table.maxDurationMinutesInclusive} >= ${table.minDurationMinutesInclusive})`,
    ),
    check(
      'rate_plans_non_base_plan_hidden_ck',
      sql`${table.isBasePlan} = true
          OR (${table.minDurationMinutesInclusive} IS NULL
              AND ${table.maxDurationMinutesInclusive} IS NULL
              AND ${table.minCheckInMinuteInclusive} IS NULL
              AND ${table.maxCheckInMinuteExclusive} IS NULL)`,
    ),
    check(
      'rate_plans_priority_safe_int_ck',
      sql`${table.priority} >= 0 AND ${table.priority} <= 1000`,
    ),
  ],
);

export const ratePlanPrices = pgTable(
  'rate_plan_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    ratePlanId: uuid('rate_plan_id').notNull(),
    priceTierId: uuid('price_tier_id').notNull(),
    amountVnd: moneyVnd('amount_vnd').notNull(),
    currency: text('currency').notNull().default('VND'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'rate_plan_prices_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'rate_plan_prices_property_rate_plan_fk',
      columns: [table.propertyId, table.ratePlanId],
      foreignColumns: [ratePlans.propertyId, ratePlans.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'rate_plan_prices_property_price_tier_fk',
      columns: [table.propertyId, table.priceTierId],
      foreignColumns: [priceTiers.propertyId, priceTiers.id],
    }).onDelete('restrict'),
    uniqueIndex('rate_plan_prices_plan_tier_uq').on(table.ratePlanId, table.priceTierId),
    check('rate_plan_prices_amount_positive_ck', sql`${table.amountVnd} > 0`),
    check('rate_plan_prices_currency_vnd_ck', sql`${table.currency} = 'VND'`),
  ],
);

export const pricingPolicyVersions = pgTable(
  'pricing_policy_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    versionNumber: bigint('version_number', { mode: 'bigint' }).notNull(),
    internalName: text('internal_name').notNull(),
    status: pricingPolicyVersionStatus('status').notNull().default('DRAFT'),
    applicabilityBasis: pricingPolicyApplicabilityBasis('applicability_basis').notNull(),
    effectiveFrom: timestamptz('effective_from').notNull(),
    effectiveUntil: timestamptz('effective_until'),
    timezoneSnapshot: text('timezone_snapshot').notNull(),
    ruleSchemaVersion: text('rule_schema_version').notNull(),
    maximumComponentLines: integer('maximum_component_lines').notNull().default(64),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    publishedBy: uuid('published_by'),
    publishedAt: timestamptz('published_at'),
    retiredBy: uuid('retired_by'),
    retiredAt: timestamptz('retired_at'),
    cancelledBy: uuid('cancelled_by'),
    cancelledAt: timestamptz('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    changeNote: text('change_note'),
    legacyProvenance: jsonb('legacy_provenance'),
  },
  (table) => [
    foreignKey({
      name: 'pricing_policy_versions_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'pricing_policy_versions_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'pricing_policy_versions_published_by_fk',
      columns: [table.publishedBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'pricing_policy_versions_retired_by_fk',
      columns: [table.retiredBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'pricing_policy_versions_cancelled_by_fk',
      columns: [table.cancelledBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    unique('pricing_policy_versions_property_id_id_uq').on(table.propertyId, table.id),
    unique('pricing_policy_versions_property_version_uq').on(table.propertyId, table.versionNumber),
    index('pricing_policy_versions_property_status_effective_idx').on(
      table.propertyId,
      table.status,
      table.effectiveFrom,
    ),
    index('pricing_policy_versions_property_basis_idx').on(
      table.propertyId,
      table.applicabilityBasis,
    ),
    check('pricing_policy_versions_version_positive_ck', sql`${table.versionNumber} > 0`),
    check(
      'pricing_policy_versions_name_ck',
      sql`btrim(${table.internalName}) <> '' AND char_length(${table.internalName}) <= 200`,
    ),
    check(
      'pricing_policy_versions_effective_interval_ck',
      sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
    check(
      'pricing_policy_versions_timezone_ck',
      sql`btrim(${table.timezoneSnapshot}) <> '' AND char_length(${table.timezoneSnapshot}) <= 100`,
    ),
    check(
      'pricing_policy_versions_rule_schema_ck',
      sql`${table.ruleSchemaVersion} ~ '^operations-v3-b0\\.2-policy-v[0-9]+$'`,
    ),
    check(
      'pricing_policy_versions_component_limit_ck',
      sql`${table.maximumComponentLines} BETWEEN 1 AND 64`,
    ),
    check(
      'pricing_policy_versions_legacy_provenance_ck',
      sql`${table.legacyProvenance} IS NULL OR jsonb_typeof(${table.legacyProvenance}) = 'object'`,
    ),
    check(
      'pricing_policy_versions_status_metadata_ck',
      sql`(${table.status} = 'DRAFT'
            AND ${table.publishedBy} IS NULL AND ${table.publishedAt} IS NULL
            AND ${table.retiredBy} IS NULL AND ${table.retiredAt} IS NULL
            AND ${table.cancelledBy} IS NULL AND ${table.cancelledAt} IS NULL
            AND ${table.cancellationReason} IS NULL)
          OR (${table.status} = 'PUBLISHED'
            AND ${table.publishedBy} IS NOT NULL AND ${table.publishedAt} IS NOT NULL
            AND ${table.retiredBy} IS NULL AND ${table.retiredAt} IS NULL
            AND ${table.cancelledBy} IS NULL AND ${table.cancelledAt} IS NULL
            AND ${table.cancellationReason} IS NULL)
          OR (${table.status} = 'RETIRED'
            AND ${table.publishedBy} IS NOT NULL AND ${table.publishedAt} IS NOT NULL
            AND ${table.retiredBy} IS NOT NULL AND ${table.retiredAt} IS NOT NULL
            AND ${table.cancelledBy} IS NULL AND ${table.cancelledAt} IS NULL
            AND ${table.cancellationReason} IS NULL)
          OR (${table.status} = 'CANCELLED'
            AND ${table.publishedBy} IS NULL AND ${table.publishedAt} IS NULL
            AND ${table.retiredBy} IS NULL AND ${table.retiredAt} IS NULL
            AND ${table.cancelledBy} IS NOT NULL AND ${table.cancelledAt} IS NOT NULL
            AND btrim(${table.cancellationReason}) <> '')`,
    ),
  ],
);

export const pricingPolicyComponents = pgTable(
  'pricing_policy_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    policyVersionId: uuid('policy_version_id').notNull(),
    componentCode: text('component_code').notNull(),
    componentKind: pricingPolicyComponentKind('component_kind').notNull(),
    coverageModel: pricingPolicyCoverageModel('coverage_model').notNull(),
    billingModel: pricingPolicyBillingModel('billing_model').notNull(),
    fixedDurationMinutes: integer('fixed_duration_minutes'),
    localStartMinuteInclusive: integer('local_start_minute_inclusive'),
    localEndMinuteExclusive: integer('local_end_minute_exclusive'),
    localEndDayOffset: smallint('local_end_day_offset'),
    boundaryPosition: pricingPolicyBoundaryPosition('boundary_position'),
    boundaryMinDurationMinutes: integer('boundary_min_duration_minutes'),
    boundaryMaxDurationMinutes: integer('boundary_max_duration_minutes'),
    billingUnitMinutes: integer('billing_unit_minutes'),
    minimumBillingUnits: integer('minimum_billing_units'),
    maximumBillingUnits: integer('maximum_billing_units'),
    maximumOccurrencesPerCandidate: integer('maximum_occurrences_per_candidate')
      .notNull()
      .default(1),
    conditionComplexityRank: integer('condition_complexity_rank').notNull().default(0),
    tieBreakRank: integer('tie_break_rank').notNull().default(0),
    restrictionMetadata: jsonb('restriction_metadata').notNull().default({}),
    displayMetadata: jsonb('display_metadata').notNull().default({}),
    legacyProvenance: jsonb('legacy_provenance'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'pricing_policy_components_policy_version_fk',
      columns: [table.policyVersionId],
      foreignColumns: [pricingPolicyVersions.id],
    }).onDelete('restrict'),
    unique('pricing_policy_components_policy_version_id_id_uq').on(table.policyVersionId, table.id),
    unique('pricing_policy_components_policy_code_uq').on(
      table.policyVersionId,
      table.componentCode,
    ),
    index('pricing_policy_components_policy_idx').on(table.policyVersionId),
    check('pricing_policy_components_code_ck', sql`${table.componentCode} ~ '^[A-Z0-9_]{1,64}$'`),
    check(
      'pricing_policy_components_coverage_shape_ck',
      sql`(${table.coverageModel} = 'FIXED_ELAPSED'
            AND ${table.fixedDurationMinutes} IS NOT NULL
            AND ${table.fixedDurationMinutes} BETWEEN 15 AND 44640
            AND ${table.fixedDurationMinutes} % 15 = 0
            AND ${table.localStartMinuteInclusive} IS NULL
            AND ${table.localEndMinuteExclusive} IS NULL
            AND ${table.localEndDayOffset} IS NULL
            AND ${table.boundaryPosition} IS NULL
            AND ${table.boundaryMinDurationMinutes} IS NULL
            AND ${table.boundaryMaxDurationMinutes} IS NULL)
          OR (${table.coverageModel} = 'LOCAL_CLOCK_WINDOW'
            AND ${table.fixedDurationMinutes} IS NULL
            AND ${table.localStartMinuteInclusive} IS NOT NULL
            AND ${table.localEndMinuteExclusive} IS NOT NULL
            AND ${table.localEndDayOffset} IS NOT NULL
            AND ${table.localStartMinuteInclusive} BETWEEN 0 AND 1425
            AND ${table.localStartMinuteInclusive} % 15 = 0
            AND ${table.localEndMinuteExclusive} BETWEEN 15 AND 1440
            AND ${table.localEndMinuteExclusive} % 15 = 0
            AND ${table.localEndDayOffset} IN (0, 1)
            AND ${table.localEndMinuteExclusive} + ${table.localEndDayOffset} * 1440 > ${table.localStartMinuteInclusive}
            AND ${table.boundaryPosition} IS NULL
            AND ${table.boundaryMinDurationMinutes} IS NULL
            AND ${table.boundaryMaxDurationMinutes} IS NULL)
          OR (${table.coverageModel} = 'REQUEST_BOUNDARY'
            AND ${table.fixedDurationMinutes} IS NULL
            AND ${table.localStartMinuteInclusive} IS NULL
            AND ${table.localEndMinuteExclusive} IS NULL
            AND ${table.localEndDayOffset} IS NULL
            AND ${table.boundaryPosition} IS NOT NULL
            AND ${table.boundaryMinDurationMinutes} IS NOT NULL
            AND ${table.boundaryMaxDurationMinutes} IS NOT NULL
            AND ${table.boundaryMinDurationMinutes} BETWEEN 15 AND 44640
            AND ${table.boundaryMinDurationMinutes} % 15 = 0
            AND ${table.boundaryMaxDurationMinutes} BETWEEN ${table.boundaryMinDurationMinutes} AND 44640
            AND ${table.boundaryMaxDurationMinutes} % 15 = 0
            AND ${table.maximumOccurrencesPerCandidate} = 1)`,
    ),
    check(
      'pricing_policy_components_billing_shape_ck',
      sql`(${table.billingModel} = 'FIXED_OCCURRENCE'
            AND ${table.billingUnitMinutes} IS NULL
            AND ${table.minimumBillingUnits} IS NULL
            AND ${table.maximumBillingUnits} IS NULL)
          OR (${table.billingModel} = 'STARTED_UNIT'
            AND ${table.billingUnitMinutes} IS NOT NULL
            AND ${table.billingUnitMinutes} BETWEEN 15 AND 44640
            AND ${table.billingUnitMinutes} % 15 = 0
            AND (${table.minimumBillingUnits} IS NULL OR ${table.minimumBillingUnits} > 0)
            AND (${table.maximumBillingUnits} IS NULL OR ${table.maximumBillingUnits} > 0)
            AND (${table.maximumBillingUnits} IS NULL OR ${table.minimumBillingUnits} IS NULL
              OR ${table.maximumBillingUnits} >= ${table.minimumBillingUnits}))`,
    ),
    check(
      'pricing_policy_components_occurrence_rank_ck',
      sql`${table.maximumOccurrencesPerCandidate} BETWEEN 1 AND 64
        AND ${table.conditionComplexityRank} BETWEEN 0 AND 1000
        AND ${table.tieBreakRank} BETWEEN 0 AND 1000000`,
    ),
    check(
      'pricing_policy_components_metadata_ck',
      sql`jsonb_typeof(${table.restrictionMetadata}) = 'object'
        AND jsonb_typeof(${table.displayMetadata}) = 'object'
        AND (${table.legacyProvenance} IS NULL OR jsonb_typeof(${table.legacyProvenance}) = 'object')`,
    ),
  ],
);

export const pricingPolicyComponentPrices = pgTable(
  'pricing_policy_component_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    policyVersionId: uuid('policy_version_id').notNull(),
    componentId: uuid('component_id').notNull(),
    priceTierId: uuid('price_tier_id').notNull(),
    amountVnd: moneyVnd('amount_vnd').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'pricing_policy_component_prices_policy_component_fk',
      columns: [table.policyVersionId, table.componentId],
      foreignColumns: [pricingPolicyComponents.policyVersionId, pricingPolicyComponents.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'pricing_policy_component_prices_property_policy_fk',
      columns: [table.propertyId, table.policyVersionId],
      foreignColumns: [pricingPolicyVersions.propertyId, pricingPolicyVersions.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'pricing_policy_component_prices_property_tier_fk',
      columns: [table.propertyId, table.priceTierId],
      foreignColumns: [priceTiers.propertyId, priceTiers.id],
    }).onDelete('restrict'),
    unique('pricing_policy_component_prices_policy_component_tier_uq').on(
      table.policyVersionId,
      table.componentId,
      table.priceTierId,
    ),
    index('pricing_policy_component_prices_policy_idx').on(table.policyVersionId),
    check('pricing_policy_component_prices_amount_positive_ck', sql`${table.amountVnd} > 0`),
  ],
);

export const pricingPolicyComponentEdges = pgTable(
  'pricing_policy_component_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    policyVersionId: uuid('policy_version_id').notNull(),
    predecessorComponentId: uuid('predecessor_component_id').notNull(),
    successorComponentId: uuid('successor_component_id').notNull(),
    restrictionMetadata: jsonb('restriction_metadata'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'pricing_policy_component_edges_policy_predecessor_fk',
      columns: [table.policyVersionId, table.predecessorComponentId],
      foreignColumns: [pricingPolicyComponents.policyVersionId, pricingPolicyComponents.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'pricing_policy_component_edges_policy_successor_fk',
      columns: [table.policyVersionId, table.successorComponentId],
      foreignColumns: [pricingPolicyComponents.policyVersionId, pricingPolicyComponents.id],
    }).onDelete('restrict'),
    unique('pricing_policy_component_edges_policy_id_uq').on(table.policyVersionId, table.id),
    unique('pricing_policy_component_edges_directed_uq').on(
      table.policyVersionId,
      table.predecessorComponentId,
      table.successorComponentId,
    ),
    index('pricing_policy_component_edges_predecessor_idx').on(
      table.policyVersionId,
      table.predecessorComponentId,
    ),
    index('pricing_policy_component_edges_successor_idx').on(
      table.policyVersionId,
      table.successorComponentId,
    ),
    check(
      'pricing_policy_component_edges_metadata_ck',
      sql`${table.restrictionMetadata} IS NULL OR jsonb_typeof(${table.restrictionMetadata}) = 'object'`,
    ),
  ],
);

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    normalizedCode: text('normalized_code').notNull(),
    status: couponStatus('status').notNull().default('ACTIVE'),
    discountType: couponDiscountType('discount_type').notNull(),
    fixedAmountVnd: moneyVnd('fixed_amount_vnd'),
    percentageBasisPoints: integer('percentage_basis_points'),
    maximumDiscountVnd: moneyVnd('maximum_discount_vnd'),
    minimumOrderAmountVnd: moneyVnd('minimum_order_amount_vnd')
      .notNull()
      .default(sql`0`),
    validFrom: timestamptz('valid_from').notNull(),
    validUntil: timestamptz('valid_until').notNull(),
    appliesToAllRoomTypes: boolean('applies_to_all_room_types').notNull(),
    totalUsageLimit: integer('total_usage_limit'),
    perCustomerLimit: integer('per_customer_limit'),
    firstReferencedAt: timestamptz('first_referenced_at'),
    disabledAt: timestamptz('disabled_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'coupons_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    unique('coupons_property_id_id_uq').on(table.propertyId, table.id),
    uniqueIndex('coupons_property_code_uq').on(table.propertyId, table.normalizedCode),
    check(
      'coupons_normalized_code_ck',
      sql`${table.normalizedCode} ~ '^[A-Z0-9-]{4,32}$' AND ${table.normalizedCode} = upper(${table.normalizedCode})`,
    ),
    check('coupons_validity_ck', sql`${table.validUntil} > ${table.validFrom}`),
    check(
      'coupons_discount_shape_ck',
      sql`(${table.discountType} = 'FIXED'
             AND ${table.fixedAmountVnd} IS NOT NULL
             AND ${table.fixedAmountVnd} > 0
             AND ${table.percentageBasisPoints} IS NULL
             AND ${table.maximumDiscountVnd} IS NULL)
          OR (${table.discountType} = 'PERCENTAGE'
             AND ${table.fixedAmountVnd} IS NULL
             AND ${table.percentageBasisPoints} IS NOT NULL
             AND ${table.percentageBasisPoints} BETWEEN 1 AND 10000
             AND (${table.maximumDiscountVnd} IS NULL OR ${table.maximumDiscountVnd} > 0))`,
    ),
    check('coupons_minimum_order_ck', sql`${table.minimumOrderAmountVnd} >= 0`),
    check(
      'coupons_limits_ck',
      sql`(${table.totalUsageLimit} IS NULL OR ${table.totalUsageLimit} > 0)
          AND (${table.perCustomerLimit} IS NULL OR ${table.perCustomerLimit} > 0)`,
    ),
    check(
      'coupons_disabled_at_ck',
      sql`(${table.status} = 'ACTIVE' AND ${table.disabledAt} IS NULL)
          OR (${table.status} = 'DISABLED' AND ${table.disabledAt} IS NOT NULL)`,
    ),
  ],
);

export const couponRoomTypes = pgTable(
  'coupon_room_types',
  {
    propertyId: uuid('property_id').notNull(),
    couponId: uuid('coupon_id').notNull(),
    roomTypeId: uuid('room_type_id').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'coupon_room_types_pk',
      columns: [table.couponId, table.roomTypeId],
    }),
    foreignKey({
      name: 'coupon_room_types_coupon_fk',
      columns: [table.propertyId, table.couponId],
      foreignColumns: [coupons.propertyId, coupons.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'coupon_room_types_room_type_fk',
      columns: [table.propertyId, table.roomTypeId],
      foreignColumns: [roomTypes.propertyId, roomTypes.id],
    }).onDelete('restrict'),
    index('coupon_room_types_room_type_idx').on(table.roomTypeId, table.couponId),
  ],
);

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    roomTypeId: uuid('room_type_id').notNull(),
    checkIn: timestamptz('check_in').notNull(),
    checkOut: timestamptz('check_out').notNull(),
    adults: integer('adults').notNull(),
    children: integer('children').notNull().default(0),
    currency: text('currency').notNull().default('VND'),
    baseAmountVnd: moneyVnd('base_amount_vnd').notNull(),
    extraAmountVnd: moneyVnd('extra_amount_vnd')
      .notNull()
      .default(sql`0`),
    totalAmountVnd: moneyVnd('total_amount_vnd').notNull(),
    couponId: uuid('coupon_id'),
    couponSnapshot: jsonb('coupon_snapshot'),
    pricingSnapshot: jsonb('pricing_snapshot').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'quotes_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'quotes_property_room_type_fk',
      columns: [table.propertyId, table.roomTypeId],
      foreignColumns: [roomTypes.propertyId, roomTypes.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'quotes_property_coupon_fk',
      columns: [table.propertyId, table.couponId],
      foreignColumns: [coupons.propertyId, coupons.id],
    }).onDelete('restrict'),
    check(
      'quotes_duration_ck',
      sql`${table.checkOut} > ${table.checkIn}
          AND ${table.checkOut} <= ${table.checkIn} + interval '31 days'`,
    ),
    check('quotes_occupancy_ck', sql`${table.adults} >= 1 AND ${table.children} >= 0`),
    check('quotes_currency_vnd_ck', sql`${table.currency} = 'VND'`),
    check(
      'quotes_money_ck',
      sql`${table.baseAmountVnd} >= 0
          AND ${table.extraAmountVnd} >= 0
          AND ${table.totalAmountVnd} = ${table.baseAmountVnd} + ${table.extraAmountVnd}`,
    ),
    check(
      'quotes_coupon_snapshot_ck',
      sql`(${table.couponId} IS NULL AND ${table.couponSnapshot} IS NULL)
          OR (${table.couponId} IS NOT NULL
              AND ${table.couponSnapshot} IS NOT NULL
              AND jsonb_typeof(${table.couponSnapshot}) = 'object'
              AND ${table.couponSnapshot} <> '{}'::jsonb)`,
    ),
    check(
      'quotes_pricing_snapshot_ck',
      sql`jsonb_typeof(${table.pricingSnapshot}) = 'object' AND ${table.pricingSnapshot} <> '{}'::jsonb`,
    ),
    check('quotes_expiry_ck', sql`${table.expiresAt} > ${table.createdAt}`),
    index('quotes_expiry_idx').on(table.expiresAt),
  ],
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    roomTypeId: uuid('room_type_id').notNull(),
    roomId: uuid('room_id').notNull(),
    quoteId: uuid('quote_id'),
    bookingCode: text('booking_code').notNull(),
    status: bookingStatus('status').notNull().default('HOLD'),
    checkIn: timestamptz('check_in').notNull(),
    checkOut: timestamptz('check_out').notNull(),
    adults: integer('adults').notNull(),
    children: integer('children').notNull().default(0),
    currency: text('currency').notNull().default('VND'),
    grossAmountVnd: moneyVnd('gross_amount_vnd').notNull(),
    discountAmountVnd: moneyVnd('discount_amount_vnd')
      .notNull()
      .default(sql`0`),
    finalAmountVnd: moneyVnd('final_amount_vnd').notNull(),
    pricingRuleVersion: text('pricing_rule_version'),
    priceSnapshot: jsonb('price_snapshot').notNull(),
    customerUserId: uuid('customer_user_id'),
    holdExpiresAt: timestamptz('hold_expires_at').notNull(),
    expiredAt: timestamptz('expired_at'),
    cancelledAt: timestamptz('cancelled_at'),
    cancellationPolicySnapshot: jsonb('cancellation_policy_snapshot'),
    cancellationIdempotencyKey: text('cancellation_idempotency_key'),
    cancellationRequestedAt: timestamptz('cancellation_requested_at'),
    cancellationRefundState: text('cancellation_refund_state').notNull().default('NOT_APPLICABLE'),
    cancellationRefundAmountVnd: moneyVnd('cancellation_refund_amount_vnd'),
    cancellationRetainedAmountVnd: moneyVnd('cancellation_retained_amount_vnd'),
    checkedInAt: timestamptz('checked_in_at'),
    checkedOutAt: timestamptz('checked_out_at'),
    noShowAt: timestamptz('no_show_at'),
    cancellationReason: text('cancellation_reason'),
    accessPassVersion: integer('access_pass_version').notNull().default(1),
    accessPassRevokedAt: timestamptz('access_pass_revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'bookings_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'bookings_property_room_type_fk',
      columns: [table.propertyId, table.roomTypeId],
      foreignColumns: [roomTypes.propertyId, roomTypes.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'bookings_property_room_fk',
      columns: [table.propertyId, table.roomTypeId, table.roomId],
      foreignColumns: [rooms.propertyId, rooms.roomTypeId, rooms.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'bookings_quote_fk',
      columns: [table.quoteId],
      foreignColumns: [quotes.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'bookings_customer_user_fk',
      columns: [table.customerUserId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    unique('bookings_property_id_uq').on(table.propertyId, table.id),
    unique('bookings_property_room_id_uq').on(table.propertyId, table.roomId, table.id),
    uniqueIndex('bookings_property_booking_code_uq').on(table.propertyId, table.bookingCode),
    uniqueIndex('bookings_quote_id_uq')
      .on(table.quoteId)
      .where(sql`${table.quoteId} IS NOT NULL`),
    index('bookings_customer_user_created_idx')
      .on(table.customerUserId, table.createdAt.desc())
      .where(sql`${table.customerUserId} IS NOT NULL`),
    check(
      'bookings_duration_ck',
      sql`${table.checkOut} > ${table.checkIn}
          AND ${table.checkOut} <= ${table.checkIn} + interval '31 days'`,
    ),
    check('bookings_occupancy_ck', sql`${table.adults} >= 1 AND ${table.children} >= 0`),
    check('bookings_currency_vnd_ck', sql`${table.currency} = 'VND'`),
    check(
      'bookings_money_ck',
      sql`${table.grossAmountVnd} >= 0
          AND ${table.discountAmountVnd} >= 0
          AND ${table.discountAmountVnd} <= ${table.grossAmountVnd}
          AND ${table.finalAmountVnd} = ${table.grossAmountVnd} - ${table.discountAmountVnd}`,
    ),
    check(
      'bookings_price_snapshot_ck',
      sql`jsonb_typeof(${table.priceSnapshot}) = 'object' AND ${table.priceSnapshot} <> '{}'::jsonb`,
    ),
    check('bookings_hold_expiry_ck', sql`${table.holdExpiresAt} > ${table.createdAt}`),
    check(
      'bookings_expired_at_ck',
      sql`(${table.status} = 'EXPIRED' AND ${table.expiredAt} IS NOT NULL)
                OR (${table.status} <> 'EXPIRED' AND ${table.expiredAt} IS NULL)`,
    ),
    check(
      'bookings_cancelled_at_ck',
      sql`(${table.status} = 'CANCELLED' AND ${table.cancelledAt} IS NOT NULL)
                OR (${table.status} <> 'CANCELLED' AND ${table.cancelledAt} IS NULL)`,
    ),
    check(
      'bookings_cancellation_policy_snapshot_ck',
      sql`${table.cancellationPolicySnapshot} IS NULL
          OR (jsonb_typeof(${table.cancellationPolicySnapshot}) = 'object'
              AND ${table.cancellationPolicySnapshot} <> '{}'::jsonb)`,
    ),
    check(
      'bookings_cancellation_refund_state_ck',
      sql`${table.cancellationRefundState} IN ('NOT_APPLICABLE', 'NO_REFUND', 'REVIEW_REQUIRED', 'REFUND_PENDING', 'REFUNDED')`,
    ),
    check(
      'bookings_cancellation_refund_amounts_ck',
      sql`(${table.cancellationRefundAmountVnd} IS NULL OR ${table.cancellationRefundAmountVnd} >= 0)
          AND (${table.cancellationRetainedAmountVnd} IS NULL OR ${table.cancellationRetainedAmountVnd} >= 0)
          AND (${table.status} = 'CANCELLED'
               OR (${table.cancellationRefundAmountVnd} IS NULL AND ${table.cancellationRetainedAmountVnd} IS NULL))`,
    ),
    check(
      'bookings_checked_in_at_ck',
      sql`(${table.status} IN ('CHECKED_IN', 'CHECKED_OUT')
                  AND ${table.checkedInAt} IS NOT NULL)
                OR (${table.status} NOT IN ('CHECKED_IN', 'CHECKED_OUT')
                    AND ${table.checkedInAt} IS NULL)`,
    ),
    check(
      'bookings_checked_out_at_ck',
      sql`(${table.status} = 'CHECKED_OUT' AND ${table.checkedOutAt} IS NOT NULL)
                OR (${table.status} <> 'CHECKED_OUT' AND ${table.checkedOutAt} IS NULL)`,
    ),
    check(
      'bookings_no_show_at_ck',
      sql`(${table.status} = 'NO_SHOW' AND ${table.noShowAt} IS NOT NULL)
                OR (${table.status} <> 'NO_SHOW' AND ${table.noShowAt} IS NULL)`,
    ),
    check(
      'bookings_cancellation_reason_ck',
      sql`${table.cancellationReason} IS NULL
          OR (btrim(${table.cancellationReason}) <> '' AND char_length(${table.cancellationReason}) <= 1000)`,
    ),
    check(
      'bookings_cancellation_reason_present_ck',
      sql`${table.status} <> 'CANCELLED' OR ${table.cancellationReason} IS NOT NULL`,
    ),
    index('bookings_property_status_created_idx').on(
      table.propertyId,
      table.status,
      table.createdAt.desc(),
    ),
    index('bookings_property_check_in_idx').on(table.propertyId, table.checkIn),
    uniqueIndex('bookings_cancellation_idempotency_uq')
      .on(table.cancellationIdempotencyKey)
      .where(sql`${table.cancellationIdempotencyKey} IS NOT NULL`),
  ],
);

/**
 * Durable operational work queue. This deliberately remains separate from a
 * room's current housekeeping condition: a room can be CLEAN while an
 * ARRIVAL_PREP verification task is still scheduled, and a schedule-free
 * DIRTY room can require a TURNOVER task.
 */
export const housekeepingTasks = pgTable(
  'housekeeping_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    roomId: uuid('room_id').notNull(),
    bookingId: uuid('booking_id'),
    type: housekeepingTaskType('type').notNull(),
    status: housekeepingTaskStatus('status').notNull().default('SCHEDULED'),
    dueAt: timestamptz('due_at').notNull(),
    reminderAt: timestamptz('reminder_at'),
    reminderSentAt: timestamptz('reminder_sent_at'),
    assignedTo: uuid('assigned_to'),
    assignedBy: uuid('assigned_by'),
    assignedAt: timestamptz('assigned_at'),
    startedAt: timestamptz('started_at'),
    startedBy: uuid('started_by'),
    completedAt: timestamptz('completed_at'),
    completedBy: uuid('completed_by'),
    verifiedAt: timestamptz('verified_at'),
    verifiedBy: uuid('verified_by'),
    reopenedAt: timestamptz('reopened_at'),
    reopenedBy: uuid('reopened_by'),
    reopenReason: text('reopen_reason'),
    version: integer('version').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'housekeeping_tasks_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'housekeeping_tasks_property_room_fk',
      columns: [table.propertyId, table.roomId],
      foreignColumns: [rooms.propertyId, rooms.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'housekeeping_tasks_property_booking_fk',
      columns: [table.propertyId, table.bookingId],
      foreignColumns: [bookings.propertyId, bookings.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'housekeeping_tasks_assigned_to_fk',
      columns: [table.assignedTo],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'housekeeping_tasks_assigned_by_fk',
      columns: [table.assignedBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'housekeeping_tasks_started_by_fk',
      columns: [table.startedBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'housekeeping_tasks_completed_by_fk',
      columns: [table.completedBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'housekeeping_tasks_verified_by_fk',
      columns: [table.verifiedBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'housekeeping_tasks_reopened_by_fk',
      columns: [table.reopenedBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    unique('housekeeping_tasks_property_id_uq').on(table.propertyId, table.id),
    uniqueIndex('housekeeping_tasks_booking_type_uq')
      .on(table.bookingId, table.type)
      .where(sql`${table.bookingId} IS NOT NULL`),
    index('housekeeping_tasks_property_status_due_idx').on(
      table.propertyId,
      table.status,
      table.dueAt,
    ),
    index('housekeeping_tasks_room_status_due_idx').on(table.roomId, table.status, table.dueAt),
    check(
      'housekeeping_tasks_reminder_sent_ck',
      sql`${table.reminderSentAt} IS NULL OR ${table.reminderAt} IS NOT NULL`,
    ),
    check(
      'housekeeping_tasks_completed_at_ck',
      sql`(${table.status} = 'DONE' AND ${table.completedAt} IS NOT NULL)
          OR (${table.status} <> 'DONE' AND ${table.completedAt} IS NULL)`,
    ),
    check('housekeeping_tasks_version_nonnegative_ck', sql`${table.version} >= 0`),
  ],
);

/**
 * Provider-managed access credentials deliberately store only a provider
 * reference. Plaintext door codes and signed payloads remain outside the
 * application database and audit stream.
 */
export const accessCredentials = pgTable(
  'access_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    bookingId: uuid('booking_id').notNull(),
    roomId: uuid('room_id').notNull(),
    provider: accessCredentialProvider('provider').notNull(),
    providerCredentialReference: text('provider_credential_reference').notNull(),
    status: accessCredentialStatus('status').notNull().default('PENDING'),
    validFrom: timestamptz('valid_from').notNull(),
    validUntil: timestamptz('valid_until').notNull(),
    issuedAt: timestamptz('issued_at'),
    deliveredAt: timestamptz('delivered_at'),
    revokedAt: timestamptz('revoked_at'),
    failureCode: text('failure_code'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'access_credentials_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'access_credentials_property_booking_fk',
      columns: [table.propertyId, table.bookingId],
      foreignColumns: [bookings.propertyId, bookings.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'access_credentials_property_room_fk',
      columns: [table.propertyId, table.roomId],
      foreignColumns: [rooms.propertyId, rooms.id],
    }).onDelete('restrict'),
    uniqueIndex('access_credentials_provider_reference_uq').on(
      table.provider,
      table.providerCredentialReference,
    ),
    uniqueIndex('access_credentials_booking_idempotency_uq').on(
      table.bookingId,
      table.idempotencyKey,
    ),
    uniqueIndex('access_credentials_booking_active_uq')
      .on(table.bookingId)
      .where(sql`${table.status} IN ('PENDING', 'ISSUED', 'DELIVERED')`),
    index('access_credentials_issuance_idx').on(table.status, table.validFrom),
    check(
      'access_credentials_reference_nonempty_ck',
      sql`btrim(${table.providerCredentialReference}) <> ''`,
    ),
    check(
      'access_credentials_idempotency_key_nonempty_ck',
      sql`btrim(${table.idempotencyKey}) <> '' AND char_length(${table.idempotencyKey}) <= 128`,
    ),
    check('access_credentials_valid_interval_ck', sql`${table.validUntil} > ${table.validFrom}`),
    check(
      'access_credentials_status_fields_ck',
      sql`(${table.status} = 'PENDING'
             AND ${table.issuedAt} IS NULL
             AND ${table.deliveredAt} IS NULL
             AND ${table.revokedAt} IS NULL
             AND ${table.failureCode} IS NULL)
          OR (${table.status} = 'ISSUED'
              AND ${table.issuedAt} IS NOT NULL
              AND ${table.deliveredAt} IS NULL
              AND ${table.revokedAt} IS NULL
              AND ${table.failureCode} IS NULL)
          OR (${table.status} = 'DELIVERED'
              AND ${table.issuedAt} IS NOT NULL
              AND ${table.deliveredAt} IS NOT NULL
              AND ${table.revokedAt} IS NULL
              AND ${table.failureCode} IS NULL)
          OR (${table.status} = 'REVOKED'
              AND ${table.issuedAt} IS NOT NULL
              AND ${table.revokedAt} IS NOT NULL
              AND ${table.failureCode} IS NULL)
          OR (${table.status} = 'FAILED'
              AND ${table.issuedAt} IS NULL
              AND ${table.deliveredAt} IS NULL
              AND ${table.revokedAt} IS NULL
              AND ${table.failureCode} IS NOT NULL)`,
    ),
  ],
);

export const bookingCouponApplications = pgTable(
  'booking_coupon_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    bookingId: uuid('booking_id').notNull(),
    couponId: uuid('coupon_id').notNull(),
    customerEmailDigest: bytea('customer_email_digest').notNull(),
    applicationStatus: couponApplicationStatus('application_status').notNull(),
    quotaReserved: boolean('quota_reserved').notNull(),
    discountType: couponDiscountType('discount_type').notNull(),
    fixedAmountVnd: moneyVnd('fixed_amount_vnd'),
    percentageBasisPoints: integer('percentage_basis_points'),
    maximumDiscountVnd: moneyVnd('maximum_discount_vnd'),
    minimumOrderAmountVnd: moneyVnd('minimum_order_amount_vnd').notNull(),
    grossAmountVnd: moneyVnd('gross_amount_vnd').notNull(),
    discountAmountVnd: moneyVnd('discount_amount_vnd').notNull(),
    finalAmountVnd: moneyVnd('final_amount_vnd').notNull(),
    couponCodeSnapshot: text('coupon_code_snapshot').notNull(),
    reservedAt: timestamptz('reserved_at'),
    redeemedAt: timestamptz('redeemed_at'),
    releasedAt: timestamptz('released_at'),
    redemptionEventKey: text('redemption_event_key'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'booking_coupon_applications_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'booking_coupon_applications_booking_fk',
      columns: [table.propertyId, table.bookingId],
      foreignColumns: [bookings.propertyId, bookings.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'booking_coupon_applications_coupon_fk',
      columns: [table.propertyId, table.couponId],
      foreignColumns: [coupons.propertyId, coupons.id],
    }).onDelete('restrict'),
    uniqueIndex('booking_coupon_applications_booking_uq').on(table.bookingId),
    uniqueIndex('booking_coupon_applications_redemption_event_uq')
      .on(table.redemptionEventKey)
      .where(sql`${table.redemptionEventKey} IS NOT NULL`),
    index('booking_coupon_applications_quota_idx').on(table.couponId, table.applicationStatus),
    index('booking_coupon_applications_customer_quota_idx').on(
      table.couponId,
      table.customerEmailDigest,
      table.applicationStatus,
    ),
    check(
      'booking_coupon_applications_email_digest_length_ck',
      sql`octet_length(${table.customerEmailDigest}) = 32`,
    ),
    check(
      'booking_coupon_applications_code_ck',
      sql`${table.couponCodeSnapshot} ~ '^[A-Z0-9-]{4,32}$'`,
    ),
    check(
      'booking_coupon_applications_discount_shape_ck',
      sql`(${table.discountType} = 'FIXED'
             AND ${table.fixedAmountVnd} IS NOT NULL
             AND ${table.fixedAmountVnd} > 0
             AND ${table.percentageBasisPoints} IS NULL
             AND ${table.maximumDiscountVnd} IS NULL)
          OR (${table.discountType} = 'PERCENTAGE'
             AND ${table.fixedAmountVnd} IS NULL
             AND ${table.percentageBasisPoints} IS NOT NULL
             AND ${table.percentageBasisPoints} BETWEEN 1 AND 10000
             AND (${table.maximumDiscountVnd} IS NULL OR ${table.maximumDiscountVnd} > 0))`,
    ),
    check(
      'booking_coupon_applications_amounts_ck',
      sql`${table.minimumOrderAmountVnd} >= 0
          AND ${table.grossAmountVnd} >= 0
          AND ${table.discountAmountVnd} >= 0
          AND ${table.discountAmountVnd} <= ${table.grossAmountVnd}
          AND ${table.finalAmountVnd} = ${table.grossAmountVnd} - ${table.discountAmountVnd}`,
    ),
    check(
      'booking_coupon_applications_lifecycle_ck',
      sql`(${table.applicationStatus} = 'ASSOCIATED'
             AND ${table.quotaReserved} = false
             AND ${table.reservedAt} IS NULL
             AND ${table.redeemedAt} IS NULL
             AND ${table.releasedAt} IS NULL
             AND ${table.redemptionEventKey} IS NULL)
          OR (${table.applicationStatus} = 'RESERVED'
             AND ${table.quotaReserved} = true
             AND ${table.reservedAt} IS NOT NULL
             AND ${table.redeemedAt} IS NULL
             AND ${table.releasedAt} IS NULL
             AND ${table.redemptionEventKey} IS NULL)
          OR (${table.applicationStatus} = 'REDEEMED'
             AND ${table.redeemedAt} IS NOT NULL
             AND ${table.releasedAt} IS NULL
             AND ${table.redemptionEventKey} IS NOT NULL
             AND ((${table.quotaReserved} = true AND ${table.reservedAt} IS NOT NULL)
                  OR (${table.quotaReserved} = false AND ${table.reservedAt} IS NULL)))
          OR (${table.applicationStatus} = 'RELEASED'
             AND ${table.quotaReserved} = false
             AND ${table.redeemedAt} IS NULL
             AND ${table.releasedAt} IS NOT NULL
             AND ${table.redemptionEventKey} IS NULL)`,
    ),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    bookingId: uuid('booking_id').notNull(),
    status: paymentStatus('status').notNull().default('PENDING'),
    amountVnd: moneyVnd('amount_vnd').notNull(),
    currency: text('currency').notNull().default('VND'),
    confirmationSource: paymentConfirmationSource('confirmation_source'),
    succeededAt: timestamptz('succeeded_at'),
    reviewRequiredAt: timestamptz('review_required_at'),
    cancelledAt: timestamptz('cancelled_at'),
    expiredAt: timestamptz('expired_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'payments_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'payments_property_booking_fk',
      columns: [table.propertyId, table.bookingId],
      foreignColumns: [bookings.propertyId, bookings.id],
    }).onDelete('restrict'),
    unique('payments_property_booking_id_id_uq').on(table.propertyId, table.bookingId, table.id),
    uniqueIndex('payments_property_booking_uq').on(table.propertyId, table.bookingId),
    index('payments_property_status_updated_idx').on(
      table.propertyId,
      table.status,
      table.updatedAt,
    ),
    check('payments_amount_nonnegative_ck', sql`${table.amountVnd} >= 0`),
    check('payments_currency_vnd_ck', sql`${table.currency} = 'VND'`),
    check(
      'payments_lifecycle_timestamps_ck',
      sql`(${table.status} = 'PENDING'
             AND ${table.confirmationSource} IS NULL
             AND ${table.succeededAt} IS NULL
             AND ${table.reviewRequiredAt} IS NULL
             AND ${table.cancelledAt} IS NULL
             AND ${table.expiredAt} IS NULL)
          OR (${table.status} = 'SUCCEEDED'
              AND ${table.confirmationSource} IS NOT NULL
              AND ${table.succeededAt} IS NOT NULL
              AND ${table.reviewRequiredAt} IS NULL
              AND ${table.cancelledAt} IS NULL
              AND ${table.expiredAt} IS NULL)
          OR (${table.status} = 'REVIEW_REQUIRED'
              AND ${table.confirmationSource} IS NULL
              AND ${table.succeededAt} IS NULL
              AND ${table.reviewRequiredAt} IS NOT NULL
              AND ${table.cancelledAt} IS NULL
              AND ${table.expiredAt} IS NULL)
          OR (${table.status} = 'CANCELLED'
              AND ${table.confirmationSource} IS NULL
              AND ${table.succeededAt} IS NULL
              AND ${table.reviewRequiredAt} IS NULL
              AND ${table.cancelledAt} IS NOT NULL
              AND ${table.expiredAt} IS NULL)
          OR (${table.status} = 'EXPIRED'
              AND ${table.confirmationSource} IS NULL
              AND ${table.succeededAt} IS NULL
              AND ${table.reviewRequiredAt} IS NULL
              AND ${table.cancelledAt} IS NULL
              AND ${table.expiredAt} IS NOT NULL)`,
    ),
    check(
      'payments_no_charge_amount_ck',
      sql`${table.confirmationSource} <> 'NO_CHARGE' OR ${table.amountVnd} = 0`,
    ),
  ],
);

export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    paymentId: uuid('payment_id').notNull(),
    provider: paymentProvider('provider').notNull(),
    status: paymentAttemptStatus('status').notNull().default('PENDING'),
    idempotencyKey: text('idempotency_key').notNull(),
    providerOrderId: text('provider_order_id').notNull(),
    providerTransactionId: text('provider_transaction_id'),
    amountVnd: moneyVnd('amount_vnd').notNull(),
    currency: text('currency').notNull().default('VND'),
    initiatedAt: timestamptz('initiated_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at'),
    completedAt: timestamptz('completed_at'),
    failureCode: text('failure_code'),
    reviewCode: text('review_code'),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    reconciliationAttemptCount: integer('reconciliation_attempt_count').notNull().default(0),
    nextReconciliationAt: timestamptz('next_reconciliation_at'),
    lastReconciledAt: timestamptz('last_reconciled_at'),
    lastErrorCode: text('last_error_code'),
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: timestamptz('lease_expires_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'payment_attempts_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'payment_attempts_property_payment_fk',
      columns: [table.propertyId, table.paymentId],
      foreignColumns: [payments.propertyId, payments.id],
    }).onDelete('restrict'),
    unique('payment_attempts_property_id_id_uq').on(table.propertyId, table.id),
    uniqueIndex('payment_attempts_payment_idempotency_uq').on(
      table.paymentId,
      table.idempotencyKey,
    ),
    uniqueIndex('payment_attempts_provider_order_uq').on(table.provider, table.providerOrderId),
    uniqueIndex('payment_attempts_provider_transaction_uq')
      .on(table.provider, table.providerTransactionId)
      .where(sql`${table.providerTransactionId} IS NOT NULL`),
    check('payment_attempts_amount_positive_ck', sql`${table.amountVnd} > 0`),
    check('payment_attempts_currency_vnd_ck', sql`${table.currency} = 'VND'`),
    check(
      'payment_attempts_idempotency_key_ck',
      sql`btrim(${table.idempotencyKey}) <> '' AND char_length(${table.idempotencyKey}) <= 128`,
    ),
    check(
      'payment_attempts_provider_order_id_ck',
      sql`btrim(${table.providerOrderId}) <> '' AND char_length(${table.providerOrderId}) <= 128`,
    ),
    check(
      'payment_attempts_provider_transaction_id_ck',
      sql`${table.providerTransactionId} IS NULL OR (btrim(${table.providerTransactionId}) <> '' AND char_length(${table.providerTransactionId}) <= 128)`,
    ),
    index('payment_attempts_reconciliation_eligible_idx').on(
      table.status,
      table.nextReconciliationAt,
      table.leaseExpiresAt,
    ),
    check(
      'payment_attempts_reconciliation_attempt_count_ck',
      sql`${table.reconciliationAttemptCount} >= 0`,
    ),
    check(
      'payment_attempts_reconciliation_lease_ck',
      sql`(${table.leaseOwner} IS NULL AND ${table.leaseExpiresAt} IS NULL)
          OR (${table.leaseOwner} IS NOT NULL AND btrim(${table.leaseOwner}) <> '' AND ${table.leaseExpiresAt} IS NOT NULL)`,
    ),
    check(
      'payment_attempts_reconciliation_error_ck',
      sql`${table.lastErrorCode} IS NULL OR btrim(${table.lastErrorCode}) <> ''`,
    ),
    check(
      'payment_attempts_lifecycle_fields_ck',
      sql`(${table.status} = 'PENDING'
             AND ${table.completedAt} IS NULL
             AND ${table.failureCode} IS NULL
             AND ${table.reviewCode} IS NULL)
          OR (${table.status} = 'SUCCEEDED'
              AND ${table.completedAt} IS NOT NULL
              AND ${table.providerTransactionId} IS NOT NULL
              AND ${table.failureCode} IS NULL
              AND ${table.reviewCode} IS NULL)
          OR (${table.status} = 'FAILED'
              AND ${table.completedAt} IS NOT NULL
              AND ${table.failureCode} IS NOT NULL
              AND ${table.reviewCode} IS NULL)
          OR (${table.status} IN ('CANCELLED', 'EXPIRED')
              AND ${table.completedAt} IS NOT NULL
              AND ${table.failureCode} IS NULL
              AND ${table.reviewCode} IS NULL)
          OR (${table.status} = 'REVIEW_REQUIRED'
              AND ${table.completedAt} IS NOT NULL
              AND ${table.failureCode} IS NULL
              AND ${table.reviewCode} IS NOT NULL)`,
    ),
  ],
);

export const paymentProviderEvents = pgTable(
  'payment_provider_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id'),
    paymentAttemptId: uuid('payment_attempt_id'),
    provider: paymentProvider('provider').notNull(),
    eventKey: text('event_key').notNull(),
    providerOrderId: text('provider_order_id').notNull(),
    providerTransactionId: text('provider_transaction_id'),
    normalizedOutcome: paymentNormalizedOutcome('normalized_outcome').notNull(),
    amountVnd: moneyVnd('amount_vnd'),
    currency: text('currency'),
    rawBodyDigest: bytea('raw_body_digest').notNull(),
    processingStatus: paymentEventProcessingStatus('processing_status').notNull(),
    rejectionCode: text('rejection_code'),
    receivedAt: timestamptz('received_at').notNull(),
    processedAt: timestamptz('processed_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'payment_provider_events_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'payment_provider_events_property_attempt_fk',
      columns: [table.propertyId, table.paymentAttemptId],
      foreignColumns: [paymentAttempts.propertyId, paymentAttempts.id],
    }).onDelete('restrict'),
    uniqueIndex('payment_provider_events_provider_event_uq').on(table.provider, table.eventKey),
    index('payment_provider_events_provider_received_idx').on(table.provider, table.receivedAt),
    index('payment_provider_events_attempt_received_idx').on(
      table.paymentAttemptId,
      table.receivedAt,
    ),
    check(
      'payment_provider_events_resolution_pair_ck',
      sql`(${table.propertyId} IS NULL AND ${table.paymentAttemptId} IS NULL)
          OR (${table.propertyId} IS NOT NULL AND ${table.paymentAttemptId} IS NOT NULL)`,
    ),
    check(
      'payment_provider_events_digest_length_ck',
      sql`octet_length(${table.rawBodyDigest}) = 32`,
    ),
    check(
      'payment_provider_events_amount_ck',
      sql`${table.amountVnd} IS NULL OR ${table.amountVnd} >= 0`,
    ),
    check(
      'payment_provider_events_currency_ck',
      sql`${table.currency} IS NULL OR ${table.currency} = 'VND'`,
    ),
    check(
      'payment_provider_events_identifiers_ck',
      sql`btrim(${table.eventKey}) <> '' AND char_length(${table.eventKey}) <= 256
          AND btrim(${table.providerOrderId}) <> '' AND char_length(${table.providerOrderId}) <= 128
          AND (${table.providerTransactionId} IS NULL OR (btrim(${table.providerTransactionId}) <> '' AND char_length(${table.providerTransactionId}) <= 128))`,
    ),
    check('payment_provider_events_processing_fields_ck', sql`${table.processedAt} IS NOT NULL`),
    check(
      'payment_provider_events_rejection_code_ck',
      sql`(${table.processingStatus} IN ('REJECTED', 'REVIEW_REQUIRED') AND ${table.rejectionCode} IS NOT NULL)
          OR (${table.processingStatus} IN ('PROCESSED', 'DUPLICATE') AND ${table.rejectionCode} IS NULL)`,
    ),
  ],
);

/** Operational display/availability state only. Merchant credentials remain environment-owned. */
export const paymentProviderSettings = pgTable(
  'payment_provider_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    provider: paymentProvider('provider').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    displayName: text('display_name').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    checkoutExpiryMinutes: integer('checkout_expiry_minutes').notNull().default(15),
    maintenanceMessage: text('maintenance_message'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'payment_provider_settings_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    unique('payment_provider_settings_property_provider_uq').on(table.propertyId, table.provider),
    check('payment_provider_settings_display_name_ck', sql`btrim(${table.displayName}) <> ''`),
    check('payment_provider_settings_display_order_ck', sql`${table.displayOrder} >= 0`),
    check(
      'payment_provider_settings_expiry_ck',
      sql`${table.checkoutExpiryMinutes} BETWEEN 1 AND 60`,
    ),
    check(
      'payment_provider_settings_maintenance_message_ck',
      sql`${table.maintenanceMessage} IS NULL OR char_length(${table.maintenanceMessage}) <= 500`,
    ),
  ],
);

export const maintenanceBlocks = pgTable(
  'maintenance_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    roomId: uuid('room_id').notNull(),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at').notNull(),
    reason: text('reason').notNull(),
    status: maintenanceBlockStatus('status').notNull().default('ACTIVE'),
    cancelledAt: timestamptz('cancelled_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'maintenance_blocks_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'maintenance_blocks_property_room_fk',
      columns: [table.propertyId, table.roomId],
      foreignColumns: [rooms.propertyId, rooms.id],
    }).onDelete('restrict'),
    unique('maintenance_blocks_property_room_id_uq').on(table.propertyId, table.roomId, table.id),
    check('maintenance_blocks_interval_ck', sql`${table.endsAt} > ${table.startsAt}`),
    check('maintenance_blocks_reason_nonempty_ck', sql`btrim(${table.reason}) <> ''`),
    check(
      'maintenance_blocks_cancelled_at_ck',
      sql`(${table.status} = 'CANCELLED' AND ${table.cancelledAt} IS NOT NULL)
          OR (${table.status} = 'ACTIVE' AND ${table.cancelledAt} IS NULL)`,
    ),
  ],
);

export const roomInventoryBlocks = pgTable(
  'room_inventory_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    roomId: uuid('room_id').notNull(),
    bookingId: uuid('booking_id'),
    maintenanceBlockId: uuid('maintenance_block_id'),
    blockType: inventoryBlockType('block_type').notNull(),
    status: inventoryBlockStatus('status').notNull().default('ACTIVE'),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at').notNull(),
    releasedAt: timestamptz('released_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'room_inventory_blocks_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'room_inventory_blocks_property_room_fk',
      columns: [table.propertyId, table.roomId],
      foreignColumns: [rooms.propertyId, rooms.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'room_inventory_blocks_booking_fk',
      columns: [table.propertyId, table.roomId, table.bookingId],
      foreignColumns: [bookings.propertyId, bookings.roomId, bookings.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'room_inventory_blocks_maintenance_fk',
      columns: [table.propertyId, table.roomId, table.maintenanceBlockId],
      foreignColumns: [
        maintenanceBlocks.propertyId,
        maintenanceBlocks.roomId,
        maintenanceBlocks.id,
      ],
    }).onDelete('restrict'),
    check('room_inventory_blocks_interval_ck', sql`${table.endsAt} > ${table.startsAt}`),
    check(
      'room_inventory_blocks_source_ck',
      sql`(${table.blockType} = 'BOOKING' AND ${table.bookingId} IS NOT NULL AND ${table.maintenanceBlockId} IS NULL)
          OR (${table.blockType} = 'MAINTENANCE' AND ${table.bookingId} IS NULL AND ${table.maintenanceBlockId} IS NOT NULL)`,
    ),
    check(
      'room_inventory_blocks_released_at_ck',
      sql`(${table.status} = 'RELEASED' AND ${table.releasedAt} IS NOT NULL)
          OR (${table.status} = 'ACTIVE' AND ${table.releasedAt} IS NULL)`,
    ),
    uniqueIndex('room_inventory_blocks_booking_uq').on(table.bookingId),
    uniqueIndex('room_inventory_blocks_maintenance_uq').on(table.maintenanceBlockId),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id'),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    actorType: auditActorType('actor_type').notNull(),
    actorId: uuid('actor_id'),
    payload: jsonb('payload').notNull().default({}),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'audit_events_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    check('audit_events_aggregate_type_nonempty_ck', sql`btrim(${table.aggregateType}) <> ''`),
    check('audit_events_event_type_nonempty_ck', sql`btrim(${table.eventType}) <> ''`),
    check('audit_events_payload_object_ck', sql`jsonb_typeof(${table.payload}) = 'object'`),
    index('audit_events_aggregate_idx').on(
      table.aggregateType,
      table.aggregateId,
      table.occurredAt,
    ),
  ],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id'),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxStatus('status').notNull().default('PENDING'),
    attemptCount: integer('attempt_count').notNull().default(0),
    availableAt: timestamptz('available_at').notNull().defaultNow(),
    publishedAt: timestamptz('published_at'),
    lastError: text('last_error'),
    leaseId: uuid('lease_id'),
    claimedAt: timestamptz('claimed_at'),
    leaseExpiresAt: timestamptz('lease_expires_at'),
    lastErrorCategory: text('last_error_category'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'outbox_events_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    check('outbox_events_aggregate_type_nonempty_ck', sql`btrim(${table.aggregateType}) <> ''`),
    check('outbox_events_event_type_nonempty_ck', sql`btrim(${table.eventType}) <> ''`),
    check('outbox_events_payload_object_ck', sql`jsonb_typeof(${table.payload}) = 'object'`),
    check('outbox_events_attempt_count_ck', sql`${table.attemptCount} >= 0`),
    check(
      'outbox_events_published_at_ck',
      sql`(${table.status} = 'PUBLISHED' AND ${table.publishedAt} IS NOT NULL)
          OR (${table.status} <> 'PUBLISHED' AND ${table.publishedAt} IS NULL)`,
    ),
    check(
      'outbox_events_lease_consistency_ck',
      sql`(${table.leaseId} IS NULL AND ${table.claimedAt} IS NULL AND ${table.leaseExpiresAt} IS NULL)
          OR (${table.leaseId} IS NOT NULL AND ${table.claimedAt} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)`,
    ),
    check(
      'outbox_events_lease_status_ck',
      sql`${table.status} = 'PENDING' OR ${table.leaseId} IS NULL`,
    ),
  ],
);

export const couponDeliveryRequests = pgTable(
  'coupon_delivery_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    bookingId: uuid('booking_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    couponCodes: jsonb('coupon_codes').$type<readonly string[]>().notNull(),
    status: text('status').$type<'PENDING' | 'SENT'>().notNull().default('PENDING'),
    sentAt: timestamptz('sent_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'coupon_delivery_requests_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'coupon_delivery_requests_booking_fk',
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
    }).onDelete('restrict'),
    check('coupon_delivery_requests_idempotency_ck', sql`btrim(${table.idempotencyKey}) <> ''`),
    check(
      'coupon_delivery_requests_codes_ck',
      sql`jsonb_typeof(${table.couponCodes}) = 'array' AND jsonb_array_length(${table.couponCodes}) BETWEEN 1 AND 10`,
    ),
    check(
      'coupon_delivery_requests_status_ck',
      sql`(${table.status} = 'PENDING' AND ${table.sentAt} IS NULL) OR (${table.status} = 'SENT' AND ${table.sentAt} IS NOT NULL)`,
    ),
    uniqueIndex('coupon_delivery_requests_property_idempotency_uq').on(
      table.propertyId,
      table.idempotencyKey,
    ),
    index('coupon_delivery_requests_booking_created_idx').on(table.bookingId, table.createdAt),
  ],
);

export const bookingContacts = pgTable(
  'booking_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').notNull(),
    fullName: text('full_name').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    normalizedPhoneE164: text('normalized_phone_e164').notNull(),
    emailDigest: bytea('email_digest').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'booking_contacts_booking_fk',
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
    }).onDelete('restrict'),
    uniqueIndex('booking_contacts_booking_id_uq').on(table.bookingId),
    check('booking_contacts_full_name_nonempty_ck', sql`btrim(${table.fullName}) <> ''`),
    check(
      'booking_contacts_normalized_email_nonempty_ck',
      sql`btrim(${table.normalizedEmail}) <> ''`,
    ),
    check(
      'booking_contacts_normalized_phone_nonempty_ck',
      sql`btrim(${table.normalizedPhoneE164}) <> ''`,
    ),
    check('booking_contacts_email_digest_length_ck', sql`octet_length(${table.emailDigest}) = 32`),
  ],
);

export const guestOtpChallenges = pgTable(
  'guest_otp_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').notNull(),
    nonce: bytea('nonce').notNull(),
    emailDigest: bytea('email_digest').notNull(),
    requestIpDigest: bytea('request_ip_digest').notNull(),
    challengeRefDigest: bytea('challenge_ref_digest').notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    expiresAt: timestamptz('expires_at').notNull(),
    consumedAt: timestamptz('consumed_at'),
    replacedAt: timestamptz('replaced_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'guest_otp_challenges_booking_fk',
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
    }).onDelete('restrict'),
    uniqueIndex('guest_otp_challenges_one_active_booking_uq')
      .on(table.bookingId)
      .where(sql`${table.consumedAt} IS NULL AND ${table.replacedAt} IS NULL`),
    index('guest_otp_challenges_booking_email_created_idx').on(
      table.bookingId,
      table.emailDigest,
      table.createdAt.desc(),
    ),
    index('guest_otp_challenges_ip_created_idx').on(table.requestIpDigest, table.createdAt.desc()),
    check('guest_otp_challenges_nonce_length_ck', sql`octet_length(${table.nonce}) = 32`),
    check(
      'guest_otp_challenges_email_digest_length_ck',
      sql`octet_length(${table.emailDigest}) = 32`,
    ),
    check(
      'guest_otp_challenges_request_ip_digest_length_ck',
      sql`octet_length(${table.requestIpDigest}) = 32`,
    ),
    check(
      'guest_otp_challenges_challenge_ref_digest_length_ck',
      sql`octet_length(${table.challengeRefDigest}) = 32`,
    ),
    check(
      'guest_otp_challenges_attempts_ck',
      sql`${table.attempts} >= 0 AND ${table.attempts} <= ${table.maxAttempts}`,
    ),
    check('guest_otp_challenges_max_attempts_ck', sql`${table.maxAttempts} = 5`),
    check('guest_otp_challenges_expiry_ck', sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      'guest_otp_challenges_consumed_replaced_ck',
      sql`${table.consumedAt} IS NULL OR ${table.replacedAt} IS NULL`,
    ),
  ],
);

export const guestSessions = pgTable(
  'guest_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').notNull(),
    tokenDigest: bytea('token_digest').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    createdIpDigest: bytea('created_ip_digest'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'guest_sessions_booking_fk',
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
    }).onDelete('restrict'),
    uniqueIndex('guest_sessions_token_digest_uq').on(table.tokenDigest),
    check('guest_sessions_token_digest_length_ck', sql`octet_length(${table.tokenDigest}) = 32`),
    check(
      'guest_sessions_created_ip_digest_length_ck',
      sql`${table.createdIpDigest} IS NULL OR octet_length(${table.createdIpDigest}) = 32`,
    ),
    check('guest_sessions_expiry_ck', sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const customerProfiles = pgTable(
  'customer_profiles',
  {
    userId: uuid('user_id').primaryKey(),
    normalizedPhoneE164: text('normalized_phone_e164'),
    addressLine1: text('address_line_1'),
    addressLine2: text('address_line_2'),
    ward: text('ward'),
    district: text('district'),
    province: text('province'),
    postalCode: text('postal_code'),
    countryCode: text('country_code').notNull().default('VN'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'customer_profiles_user_fk',
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    check('customer_profiles_country_code_ck', sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      'customer_profiles_phone_format_ck',
      sql`${table.normalizedPhoneE164} IS NULL OR ${table.normalizedPhoneE164} ~ '^\\+[1-9][0-9]{6,14}$'`,
    ),
    check(
      'customer_profiles_phone_length_ck',
      sql`${table.normalizedPhoneE164} IS NULL OR char_length(${table.normalizedPhoneE164}) <= 32`,
    ),
    check(
      'customer_profiles_address_line_1_length_ck',
      sql`${table.addressLine1} IS NULL OR (btrim(${table.addressLine1}) <> '' AND char_length(${table.addressLine1}) <= 200)`,
    ),
    check(
      'customer_profiles_address_line_2_length_ck',
      sql`${table.addressLine2} IS NULL OR char_length(${table.addressLine2}) <= 200`,
    ),
    check(
      'customer_profiles_ward_length_ck',
      sql`${table.ward} IS NULL OR (btrim(${table.ward}) <> '' AND char_length(${table.ward}) <= 200)`,
    ),
    check(
      'customer_profiles_district_length_ck',
      sql`${table.district} IS NULL OR (btrim(${table.district}) <> '' AND char_length(${table.district}) <= 200)`,
    ),
    check(
      'customer_profiles_province_length_ck',
      sql`${table.province} IS NULL OR (btrim(${table.province}) <> '' AND char_length(${table.province}) <= 200)`,
    ),
    check(
      'customer_profiles_postal_code_length_ck',
      sql`${table.postalCode} IS NULL OR char_length(${table.postalCode}) <= 32`,
    ),
    check(
      'customer_profiles_empty_address_ck',
      sql`(
            (${table.addressLine1} IS NULL OR btrim(${table.addressLine1}) <> '')
         OR (${table.ward} IS NULL OR btrim(${table.ward}) <> '')
         OR (${table.district} IS NULL OR btrim(${table.district}) <> '')
         OR (${table.province} IS NULL OR btrim(${table.province}) <> '')
      ) OR (
         ${table.addressLine1} IS NULL AND ${table.ward} IS NULL AND ${table.district} IS NULL AND ${table.province} IS NULL
      )`,
    ),
  ],
);

export const operationalReviews = pgTable(
  'operational_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').notNull(),
    bookingId: uuid('booking_id').notNull(),
    paymentId: uuid('payment_id'),
    category: operationalReviewCategory('category').notNull(),
    status: operationalReviewStatus('status').notNull().default('OPEN'),
    openedAt: timestamptz('opened_at').notNull().defaultNow(),
    openedReason: text('opened_reason').notNull(),
    resolvedAt: timestamptz('resolved_at'),
    resolverId: uuid('resolver_id'),
    resolvedNote: text('resolved_note'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'operational_reviews_property_fk',
      columns: [table.propertyId],
      foreignColumns: [properties.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'operational_reviews_property_booking_fk',
      columns: [table.propertyId, table.bookingId],
      foreignColumns: [bookings.propertyId, bookings.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'operational_reviews_payment_fk',
      columns: [table.propertyId, table.bookingId, table.paymentId],
      foreignColumns: [payments.propertyId, payments.bookingId, payments.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'operational_reviews_resolver_fk',
      columns: [table.resolverId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    unique('operational_reviews_property_id_uq').on(table.propertyId, table.id),
    uniqueIndex('operational_reviews_booking_open_uq')
      .on(table.bookingId, table.category)
      .where(sql`${table.status} = 'OPEN'`),
    index('operational_reviews_property_status_idx').on(
      table.propertyId,
      table.status,
      table.openedAt.desc(),
    ),
    index('operational_reviews_booking_idx').on(table.bookingId),
    index('operational_reviews_payment_review_idx')
      .on(table.paymentId)
      .where(sql`${table.paymentId} IS NOT NULL AND ${table.category} = 'PAID_CANCELLATION'`),
    check(
      'operational_reviews_opened_reason_ck',
      sql`btrim(${table.openedReason}) <> '' AND char_length(${table.openedReason}) <= 1000`,
    ),
    check(
      'operational_reviews_resolved_at_ck',
      sql`(${table.status} = 'RESOLVED' AND ${table.resolvedAt} IS NOT NULL)
          OR (${table.status} = 'OPEN' AND ${table.resolvedAt} IS NULL)`,
    ),
    check(
      'operational_reviews_resolver_ck',
      sql`(${table.status} = 'RESOLVED' AND ${table.resolverId} IS NOT NULL)
          OR (${table.status} = 'OPEN' AND ${table.resolverId} IS NULL)`,
    ),
    check(
      'operational_reviews_resolved_note_ck',
      sql`(${table.status} = 'RESOLVED'
            AND ${table.resolvedNote} IS NOT NULL
            AND btrim(${table.resolvedNote}) <> ''
            AND char_length(${table.resolvedNote}) <= 2000)
          OR (${table.status} = 'OPEN' AND ${table.resolvedNote} IS NULL)`,
    ),
    check(
      'operational_reviews_payment_optional_ck',
      sql`${table.category} <> 'PAID_CANCELLATION' OR ${table.paymentId} IS NOT NULL`,
    ),
  ],
);

export const databaseSchema = {
  accounts,
  adminDepartments,
  adminMemberships,
  adminProfiles,
  adminPropertyMemberships,
  amenities,
  auditEvents,
  bookingContacts,
  bookingCouponApplications,
  bookings,
  couponDeliveryRequests,
  couponRoomTypes,
  coupons,
  customerProfiles,
  guestOtpChallenges,
  guestSessions,
  housekeepingTasks,
  maintenanceBlocks,
  outboxEvents,
  operationalReviews,
  paymentAttempts,
  paymentProviderEvents,
  paymentProviderSettings,
  payments,
  priceTiers,
  properties,
  quotes,
  pricingPolicyComponentEdges,
  pricingPolicyComponentPrices,
  pricingPolicyComponents,
  pricingPolicyVersions,
  ratePlanPrices,
  ratePlans,
  roomInventoryBlocks,
  rooms,
  sessions,
  roomTypeAmenities,
  roomTypes,
  schemaMetadata,
  users,
  verificationRecords,
};
