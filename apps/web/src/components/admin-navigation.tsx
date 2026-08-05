'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { translate, type Locale, type MessageKey } from '../lib/i18n/messages';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';

const groups = [
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

function isCurrent(pathname: string, href: string) {
  return href === '/admin'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavigation({
  locale,
  permissions,
}: Readonly<{
  locale: Locale;
  permissions?: readonly string[];
}>) {
  const pathname = usePathname();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter(([, , required]) => {
        return permissions?.includes(required) ?? false;
      }),
    }))
    .filter((group) => group.links.length > 0);
  return (
    <SidebarContent aria-label={translate(locale, 'admin.navigation')}>
      <nav aria-label={translate(locale, 'admin.navigation')}>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{translate(locale, group.label)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.links.map(([label, href]) => {
                  const current = isCurrent(pathname, href);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={current}
                        render={<Link aria-current={current ? 'page' : undefined} href={href} />}
                      >
                        {translate(locale, label)}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </nav>
    </SidebarContent>
  );
}
