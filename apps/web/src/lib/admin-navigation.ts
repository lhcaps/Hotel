import { translate, type Locale, type MessageKey } from './i18n/messages';

type AdminProfileCode =
  | 'SUPER_ADMIN'
  | 'ROOM_STATUS_VIEWER'
  | 'OPERATIONS_MANAGER'
  | 'HOUSEKEEPING_MANAGER'
  | 'HOUSEKEEPING_STAFF'
  | 'PAYMENT_STAFF'
  | 'MAINTENANCE_MANAGER'
  | 'MAINTENANCE_STAFF'
  | 'STAFF_MANAGER';

export const adminNavigationGroups = [
  {
    label: 'admin.navReservations',
    links: [
      ['admin.overview', '/admin', 'dashboard.read'],
      ['admin.bookings', '/admin/bookings', 'booking.lifecycle.read'],
      ['admin.scanner', '/admin/scanner', 'booking.lifecycle.read'],
      ['admin.payments', '/admin/payments', 'payment.reconciliation.read'],
      ['admin.reviews', '/admin/operational-reviews', 'booking.review.read'],
    ],
  },
  {
    label: 'admin.navOperations',
    links: [
      ['admin.roomOperations', '/admin/room-operations', 'room_operations.read'],
      ['admin.housekeepingWorkboard', '/admin/housekeeping', 'housekeeping.task.read'],
      ['admin.rooms', '/admin/rooms', 'catalog.room.read'],
      ['admin.maintenance', '/admin/maintenance', 'catalog.maintenance.read'],
      ['admin.roomTypes', '/admin/room-types', 'catalog.room_type.read'],
      ['admin.amenities', '/admin/amenities', 'catalog.amenity.read'],
    ],
  },
  {
    label: 'admin.navSetup',
    links: [
      ['admin.property', '/admin/property', 'catalog.property.read'],
      ['admin.priceTiers', '/admin/price-tiers', 'catalog.price_tier.read'],
      ['admin.ratePlans', '/admin/rate-plans', 'pricing.rate_plan.read'],
      ['admin.pricingPolicies', '/admin/pricing-policies', 'pricing.policy.read'],
      ['admin.coupons', '/admin/coupons', 'coupon.read'],
      ['admin.providers', '/admin/payment-providers', 'providers.read'],
    ],
  },
  {
    label: 'admin.accounts',
    links: [
      ['admin.accounts', '/admin/accounts', 'admin.account.read'],
      ['admin.departments', '/admin/departments', 'admin.department.read'],
      ['admin.audit', '/admin/audit', 'admin.audit.read'],
    ],
  },
] as const satisfies readonly {
  readonly label: MessageKey;
  readonly links: readonly (readonly [MessageKey, string, string])[];
}[];

const roomStatusViewerNavigation = new Set(['/admin/room-operations']);
const housekeepingNavigation = new Set(['/admin/room-operations', '/admin/housekeeping']);

export function isAuthorizedAdminNavigation(
  href: string,
  requiredPermission: string,
  permissions: readonly string[] | undefined,
  profileCode: AdminProfileCode | undefined,
): boolean {
  if (profileCode === 'ROOM_STATUS_VIEWER' && !roomStatusViewerNavigation.has(href)) return false;
  if (
    (profileCode === 'HOUSEKEEPING_STAFF' || profileCode === 'HOUSEKEEPING_MANAGER') &&
    !housekeepingNavigation.has(href)
  ) {
    return false;
  }
  return permissions?.includes(requiredPermission) ?? false;
}

export function getAuthorizedAdminDestinations({
  locale,
  permissions,
  profileCode,
}: Readonly<{
  locale: Locale;
  permissions?: readonly string[];
  profileCode?: AdminProfileCode;
}>) {
  return adminNavigationGroups.flatMap((group) =>
    group.links
      .filter(([, href, required]) =>
        isAuthorizedAdminNavigation(href, required, permissions, profileCode),
      )
      .map(([label, href]) => ({ href, label: translate(locale, label) })),
  );
}
