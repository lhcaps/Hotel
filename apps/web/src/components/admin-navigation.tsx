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
      ['admin.overview', '/admin'],
      ['admin.bookings', '/admin/bookings'],
      ['admin.scanner', '/admin/scanner'],
      ['admin.payments', '/admin/payments'],
      ['admin.reviews', '/admin/operational-reviews'],
    ],
  },
  {
    label: 'admin.navOperations',
    links: [
      ['admin.rooms', '/admin/rooms'],
      ['admin.maintenance', '/admin/maintenance'],
      ['admin.roomTypes', '/admin/room-types'],
      ['admin.amenities', '/admin/amenities'],
    ],
  },
  {
    label: 'admin.navSetup',
    links: [
      ['admin.property', '/admin/property'],
      ['admin.priceTiers', '/admin/price-tiers'],
      ['admin.ratePlans', '/admin/rate-plans'],
      ['admin.coupons', '/admin/coupons'],
      ['admin.providers', '/admin/payment-providers'],
    ],
  },
  {
    label: 'admin.accounts',
    links: [
      ['admin.accounts', '/admin/accounts'],
      ['admin.customerAccounts', '/admin/customer-accounts'],
      ['admin.departments', '/admin/departments'],
      ['admin.audit', '/admin/audit'],
    ],
  },
] as const satisfies readonly {
  readonly label: MessageKey;
  readonly links: readonly (readonly [MessageKey, string])[];
}[];

function isCurrent(pathname: string, href: string) {
  return href === '/admin'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

const requiredPermissionByPath: Readonly<Record<string, string>> = {
  '/admin/property': 'catalog.property.read',
  '/admin/rooms': 'catalog.room.read',
  '/admin/maintenance': 'catalog.maintenance.read',
  '/admin/room-types': 'catalog.room_type.read',
  '/admin/amenities': 'catalog.amenity.read',
  '/admin/accounts': 'admin.account.read',
  '/admin/customer-accounts': 'admin.account.read',
  '/admin/departments': 'admin.department.read',
  '/admin/audit': 'admin.audit.read',
  '/admin/room-operations': 'catalog.room.read',
};

export function AdminNavigation({
  locale,
  permissions,
  role,
}: Readonly<{
  locale: Locale;
  permissions?: readonly string[];
  role?: 'ADMIN' | 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER';
}>) {
  const pathname = usePathname();
  const navigationGroups =
    role === 'ROOM_STATUS_VIEWER'
      ? [
          {
            label: 'admin.navOperations' as const,
            links: [['admin.roomOperations', '/admin/room-operations']] as const,
          },
        ]
      : groups;
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      links: group.links.filter(([label, href]) => {
        void label;
        const required = requiredPermissionByPath[href];
        return (
          required === undefined || permissions === undefined || permissions.includes(required)
        );
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
