export const PERMISSIONS = [
  'catalog.property.read',
  'catalog.property.manage',
  'catalog.price_tier.read',
  'catalog.price_tier.manage',
  'catalog.room_type.read',
  'catalog.room_type.manage',
  'catalog.amenity.read',
  'catalog.amenity.manage',
  'catalog.room.read',
  'catalog.room.manage',
  'catalog.maintenance.read',
  'catalog.maintenance.manage',
  'coupon.read',
  'coupon.manage',
  'pricing.rate_plan.read',
  'pricing.rate_plan.manage',
  'audit.read',
  'booking.lifecycle.read',
  'booking.lifecycle.manage',
  'booking.review.read',
  'booking.review.manage',
  'payment.reconciliation.read',
  'payment.reconciliation.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type HumanRole = 'ADMIN' | 'CUSTOMER';

export const ROLE_PERMISSIONS: Readonly<Record<HumanRole, readonly Permission[]>> = {
  ADMIN: PERMISSIONS,
  CUSTOMER: [],
};

export function hasPermissions(role: HumanRole, required: readonly Permission[]): boolean {
  const granted = ROLE_PERMISSIONS[role];
  return required.every((permission) => granted.includes(permission));
}
