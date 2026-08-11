'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeDollarSign,
  BedDouble,
  Building2,
  CalendarDays,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  MessageSquareWarning,
  PanelsTopLeft,
  QrCode,
  ScrollText,
  Tags,
  TicketPercent,
  Users,
  UsersRound,
  WalletCards,
  Wrench,
} from 'lucide-react';

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
      ['admin.overview', '/admin', 'dashboard.read', LayoutDashboard],
      ['admin.bookings', '/admin/bookings', 'booking.lifecycle.read', CalendarDays],
      ['admin.scanner', '/admin/scanner', 'booking.lifecycle.read', QrCode],
      ['admin.payments', '/admin/payments', 'payment.reconciliation.read', CreditCard],
      ['admin.reviews', '/admin/operational-reviews', 'booking.review.read', MessageSquareWarning],
    ],
  },
  {
    label: 'admin.navOperations',
    links: [
      ['admin.roomOperations', '/admin/room-operations', 'room_operations.read', PanelsTopLeft],
      ['admin.rooms', '/admin/rooms', 'catalog.room.read', BedDouble],
      ['admin.maintenance', '/admin/maintenance', 'catalog.maintenance.read', Wrench],
      ['admin.roomTypes', '/admin/room-types', 'catalog.room_type.read', Building2],
    ],
  },
  {
    label: 'admin.navSetup',
    links: [
      ['admin.property', '/admin/property', 'catalog.property.read', Building2],
      ['admin.priceTiers', '/admin/price-tiers', 'catalog.price_tier.read', Tags],
      ['admin.ratePlans', '/admin/rate-plans', 'pricing.rate_plan.read', BadgeDollarSign],
      ['admin.pricingPolicies', '/admin/pricing-policies', 'pricing.policy.read', GitBranch],
      ['admin.coupons', '/admin/coupons', 'coupon.read', TicketPercent],
      ['admin.providers', '/admin/payment-providers', 'providers.read', WalletCards],
    ],
  },
  {
    label: 'admin.accounts',
    links: [
      ['admin.accounts', '/admin/accounts', 'admin.account.read', Users],
      ['admin.departments', '/admin/departments', 'admin.department.read', UsersRound],
      ['admin.audit', '/admin/audit', 'admin.audit.read', ScrollText],
    ],
  },
] as const satisfies readonly {
  readonly label: MessageKey;
  readonly links: readonly (readonly [MessageKey, string, string, typeof LayoutDashboard])[];
}[];

function isCurrent(pathname: string, href: string) {
  return href === '/admin'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

const ROOM_STATUS_VIEWER_NAVIGATION = new Set(['/admin/room-operations']);
const HOUSEKEEPING_STAFF_NAVIGATION = new Set(['/admin/room-operations']);

export function AdminNavigation({
  locale,
  permissions,
  profileCode,
}: Readonly<{
  locale: Locale;
  permissions?: readonly string[];
  profileCode?:
    | 'SUPER_ADMIN'
    | 'ROOM_STATUS_VIEWER'
    | 'OPERATIONS_MANAGER'
    | 'HOUSEKEEPING_MANAGER'
    | 'HOUSEKEEPING_STAFF'
    | 'PAYMENT_STAFF';
}>) {
  const pathname = usePathname();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter(([, href, required]) => {
        if (profileCode === 'ROOM_STATUS_VIEWER' && !ROOM_STATUS_VIEWER_NAVIGATION.has(href)) {
          return false;
        }
        if (profileCode === 'HOUSEKEEPING_STAFF' && !HOUSEKEEPING_STAFF_NAVIGATION.has(href)) {
          return false;
        }
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
                {group.links.map(([label, href, , Icon]) => {
                  const current = isCurrent(pathname, href);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={current}
                        render={
                          <Link
                            aria-current={current ? 'page' : undefined}
                            aria-label={
                              label === 'admin.reviews'
                                ? translate(locale, 'admin.legacyReviewNavLabel')
                                : undefined
                            }
                            href={href}
                          />
                        }
                      >
                        <Icon aria-hidden="true" />
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
