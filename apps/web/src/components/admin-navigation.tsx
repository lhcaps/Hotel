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
] as const satisfies readonly {
  readonly label: MessageKey;
  readonly links: readonly (readonly [MessageKey, string])[];
}[];

function isCurrent(pathname: string, href: string) {
  return href === '/admin'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavigation({ locale }: Readonly<{ locale: Locale }>) {
  const pathname = usePathname();
  return (
    <SidebarContent aria-label={translate(locale, 'admin.navigation')}>
      <nav aria-label={translate(locale, 'admin.navigation')}>
        {groups.map((group) => (
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
