import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { AdminNavigation } from '../src/components/admin-navigation';
import { SidebarProvider } from '../src/components/ui/sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/room-operations',
}));

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
});

const VIEWER_PERMISSIONS = [
  'catalog.property.read',
  'catalog.room.read',
  'catalog.room.status.read',
  'catalog.maintenance.read',
  'rooms.read',
  'room_operations.read',
  'maintenance.read',
] as const;

const SUPER_ADMIN_PERMISSIONS = [
  'dashboard.read',
  'booking.lifecycle.read',
  'payment.reconciliation.read',
  'booking.review.read',
  'room_operations.read',
  'catalog.room.read',
  'catalog.maintenance.read',
  'catalog.room_type.read',
  'catalog.amenity.read',
  'catalog.property.read',
  'catalog.price_tier.read',
  'pricing.rate_plan.read',
  'coupon.read',
  'providers.read',
  'admin.account.read',
  'admin.department.read',
  'admin.audit.read',
] as const;

function renderNavigation(props: {
  readonly permissions: readonly string[];
  readonly profileCode: 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER';
}) {
  const navigationProps = props as unknown as Parameters<typeof AdminNavigation>[0];
  return render(
    <SidebarProvider>
      <AdminNavigation locale="vi" {...navigationProps} />
    </SidebarProvider>,
  );
}

describe('admin navigation scope', () => {
  it('renders only the room-status surface for ROOM_STATUS_VIEWER', () => {
    renderNavigation({
      permissions: VIEWER_PERMISSIONS,
      profileCode: 'ROOM_STATUS_VIEWER',
    });

    expect(screen.getByRole('link', { name: 'Tình trạng phòng' })).toHaveAttribute(
      'href',
      '/admin/room-operations',
    );
    expect(screen.queryByRole('link', { name: 'Phòng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bảo trì' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cơ sở' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tiện nghi' })).not.toBeInTheDocument();
  });

  it('keeps the full configured navigation for SUPER_ADMIN', () => {
    renderNavigation({
      permissions: SUPER_ADMIN_PERMISSIONS,
      profileCode: 'SUPER_ADMIN',
    });

    expect(screen.getByRole('link', { name: 'Đặt phòng' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Phòng' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cơ sở' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nhật ký kiểm toán' })).toBeInTheDocument();
  });
});
