'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeDollarSign,
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  MessageSquareWarning,
  Sparkles,
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

import { translate, type Locale } from '../lib/i18n/messages';
import { adminNavigationGroups, isAuthorizedAdminNavigation } from '../lib/admin-navigation';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';

const navigationIcons = {
  '/admin': LayoutDashboard,
  '/admin/bookings': CalendarDays,
  '/admin/scanner': QrCode,
  '/admin/payments': CreditCard,
  '/admin/operational-reviews': MessageSquareWarning,
  '/admin/room-operations': PanelsTopLeft,
  '/admin/housekeeping': ClipboardCheck,
  '/admin/rooms': BedDouble,
  '/admin/maintenance': Wrench,
  '/admin/room-types': Building2,
  '/admin/amenities': Sparkles,
  '/admin/property': Building2,
  '/admin/price-tiers': Tags,
  '/admin/rate-plans': BadgeDollarSign,
  '/admin/pricing-policies': GitBranch,
  '/admin/coupons': TicketPercent,
  '/admin/payment-providers': WalletCards,
  '/admin/accounts': Users,
  '/admin/departments': UsersRound,
  '/admin/audit': ScrollText,
} as const;

function isCurrent(pathname: string, href: string) {
  return href === '/admin'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

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
    | 'PAYMENT_STAFF'
    | 'MAINTENANCE_MANAGER'
    | 'MAINTENANCE_STAFF'
    | 'STAFF_MANAGER';
}>) {
  const pathname = usePathname();
  const visibleGroups = adminNavigationGroups
    .map((group) => ({
      ...group,
      links: group.links.filter(([, href, required]) =>
        isAuthorizedAdminNavigation(href, required, permissions, profileCode),
      ),
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
                  const Icon = navigationIcons[href];
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
