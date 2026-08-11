import { describe, expect, it } from 'vitest';

import {
  ADMIN_PROFILE_CODES,
  ADMIN_PROFILE_LABELS_VI,
  getProfilePermissions,
  hasPermissions,
  PERMISSIONS,
  PROFILE_PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../src/permissions.js';

describe('Phase 3 permissions', () => {
  it('exposes all administrator profiles including V3 operational profiles', () => {
    expect(ADMIN_PROFILE_CODES).toEqual([
      'SUPER_ADMIN',
      'ROOM_STATUS_VIEWER',
      'OPERATIONS_MANAGER',
      'HOUSEKEEPING_MANAGER',
      'HOUSEKEEPING_STAFF',
      'PAYMENT_STAFF',
      'MAINTENANCE_MANAGER',
      'MAINTENANCE_STAFF',
    ]);
    expect(ADMIN_PROFILE_LABELS_VI).toEqual({
      SUPER_ADMIN: 'Tổng quản trị',
      ROOM_STATUS_VIEWER: 'Nhân viên theo dõi phòng',
      OPERATIONS_MANAGER: 'Quản lý vận hành',
      HOUSEKEEPING_MANAGER: 'Quản lý buồng phòng',
      HOUSEKEEPING_STAFF: 'Nhân viên buồng phòng',
      PAYMENT_STAFF: 'Nhân viên thanh toán',
      MAINTENANCE_MANAGER: 'Quản lý bảo trì',
      MAINTENANCE_STAFF: 'Nhân viên bảo trì',
    });
    expect(ROLE_PERMISSIONS.ADMIN).toEqual([]);
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toEqual(PERMISSIONS);
    expect(ROLE_PERMISSIONS.CUSTOMER).toEqual([]);
    expect(
      hasPermissions('SUPER_ADMIN', [
        'catalog.room.manage',
        'audit.read',
        'pricing.rate_plan.read',
      ]),
    ).toBe(true);
    expect(hasPermissions('CUSTOMER', ['catalog.room.read'])).toBe(false);
  });
});

describe('Phase 8B.1 payment reconciliation permissions', () => {
  it('includes payment.reconciliation.read and payment.reconciliation.manage in PERMISSIONS', () => {
    expect(PERMISSIONS).toContain('payment.reconciliation.read');
    expect(PERMISSIONS).toContain('payment.reconciliation.manage');
  });

  it('grants payment reconciliation permissions only to SUPER_ADMIN', () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain('payment.reconciliation.read');
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain('payment.reconciliation.manage');
    expect(ROLE_PERMISSIONS.CUSTOMER).not.toContain('payment.reconciliation.read');
    expect(ROLE_PERMISSIONS.CUSTOMER).not.toContain('payment.reconciliation.manage');
    expect(
      hasPermissions('SUPER_ADMIN', [
        'payment.reconciliation.read',
        'payment.reconciliation.manage',
      ]),
    ).toBe(true);
    expect(hasPermissions('CUSTOMER', ['payment.reconciliation.read'])).toBe(false);
    expect(hasPermissions('CUSTOMER', ['payment.reconciliation.manage'])).toBe(false);
  });

  it('keeps room status viewing read-only and reserves account management for super admins', () => {
    expect(ROLE_PERMISSIONS.ROOM_STATUS_VIEWER).toEqual([
      'catalog.property.read',
      'catalog.room.read',
      'catalog.room.status.read',
      'catalog.maintenance.read',
      'rooms.read',
      'room_operations.read',
      'maintenance.read',
    ]);
    expect(hasPermissions('ROOM_STATUS_VIEWER', ['catalog.room.status.read'])).toBe(true);
    expect(hasPermissions('ROOM_STATUS_VIEWER', ['catalog.room.manage'])).toBe(false);
    expect(hasPermissions('ROOM_STATUS_VIEWER', ['admin.account.read'])).toBe(false);
    expect(hasPermissions('ROOM_STATUS_VIEWER', ['payments.read'])).toBe(false);
    expect(hasPermissions('SUPER_ADMIN', ['admin.account.manage', 'admin.audit.read'])).toBe(true);
  });
});

describe('V3 RBAC operational profiles — least-privilege separation', () => {
  it('OPERATIONS_MANAGER has booking and room management but not payment mutation or account admin', () => {
    const perms = PROFILE_PERMISSIONS.OPERATIONS_MANAGER;
    expect(perms).toContain('bookings.read');
    expect(perms).toContain('bookings.manage');
    expect(perms).toContain('room_operations.manage');
    expect(perms).toContain('catalog.room.manage');
    // Must NOT have financial or account management
    expect(perms).not.toContain('payments.refund');
    expect(perms).not.toContain('admin.account.manage');
    expect(perms).not.toContain('pricing.policy.publish');
  });

  it('HOUSEKEEPING_MANAGER has room/maintenance ops but not booking mutation or financial access', () => {
    const perms = PROFILE_PERMISSIONS.HOUSEKEEPING_MANAGER;
    expect(perms).toContain('room_operations.manage');
    expect(perms).toContain('rooms.read');
    expect(perms).toContain('catalog.room.status.read');
    // Must NOT have financial, booking mutation, or account access
    expect(perms).not.toContain('bookings.manage');
    expect(perms).not.toContain('payments.read');
    expect(perms).not.toContain('admin.account.read');
    expect(perms).not.toContain('pricing.manage');
  });

  it('HOUSEKEEPING_STAFF has only read access to rooms and operations — cannot mutate catalog or bookings', () => {
    const perms = PROFILE_PERMISSIONS.HOUSEKEEPING_STAFF;
    expect(perms).toContain('rooms.read');
    expect(perms).toContain('room_operations.read');
    expect(perms).toContain('catalog.room.status.read');
    // Must NOT have any mutation permission
    expect(perms).not.toContain('room_operations.manage');
    expect(perms).not.toContain('catalog.room.manage');
    expect(perms).not.toContain('bookings.manage');
    expect(perms).not.toContain('payments.read');
    expect(perms).not.toContain('admin.account.read');
  });

  it('PAYMENT_STAFF has payment reconciliation but not booking mutation or catalog access', () => {
    const perms = PROFILE_PERMISSIONS.PAYMENT_STAFF;
    expect(perms).toContain('payments.read');
    expect(perms).toContain('payment.reconciliation.read');
    expect(perms).toContain('payment.reconciliation.manage');
    // Must NOT have room/catalog/booking mutation
    expect(perms).not.toContain('bookings.manage');
    expect(perms).not.toContain('catalog.room.manage');
    expect(perms).not.toContain('admin.account.manage');
  });

  it('MAINTENANCE_MANAGER has maintenance management but not booking mutation or financial access', () => {
    const perms = PROFILE_PERMISSIONS.MAINTENANCE_MANAGER;
    expect(perms).toContain('maintenance.read');
    expect(perms).toContain('maintenance.manage');
    expect(perms).toContain('catalog.maintenance.manage');
    expect(perms).toContain('room_operations.read');
    // Must NOT have booking, financial, or account access
    expect(perms).not.toContain('bookings.manage');
    expect(perms).not.toContain('payments.read');
    expect(perms).not.toContain('admin.account.read');
    expect(perms).not.toContain('room_operations.manage');
  });

  it('MAINTENANCE_STAFF has only read access to maintenance and rooms — cannot mutate catalog or bookings', () => {
    const perms = PROFILE_PERMISSIONS.MAINTENANCE_STAFF;
    expect(perms).toContain('maintenance.read');
    expect(perms).toContain('catalog.maintenance.read');
    expect(perms).toContain('rooms.read');
    // Must NOT have any mutation permission
    expect(perms).not.toContain('maintenance.manage');
    expect(perms).not.toContain('catalog.maintenance.manage');
    expect(perms).not.toContain('bookings.manage');
    expect(perms).not.toContain('payments.read');
    expect(perms).not.toContain('admin.account.read');
  });

  it('getProfilePermissions returns correct permissions for each profile', () => {
    expect(getProfilePermissions('SUPER_ADMIN')).toEqual(PERMISSIONS);
    expect(getProfilePermissions('ROOM_STATUS_VIEWER')).toEqual(
      PROFILE_PERMISSIONS.ROOM_STATUS_VIEWER,
    );
    expect(getProfilePermissions('OPERATIONS_MANAGER')).toEqual(
      PROFILE_PERMISSIONS.OPERATIONS_MANAGER,
    );
    expect(getProfilePermissions('HOUSEKEEPING_MANAGER')).toEqual(
      PROFILE_PERMISSIONS.HOUSEKEEPING_MANAGER,
    );
    expect(getProfilePermissions('HOUSEKEEPING_STAFF')).toEqual(
      PROFILE_PERMISSIONS.HOUSEKEEPING_STAFF,
    );
    expect(getProfilePermissions('PAYMENT_STAFF')).toEqual(PROFILE_PERMISSIONS.PAYMENT_STAFF);
    expect(getProfilePermissions('MAINTENANCE_MANAGER')).toEqual(
      PROFILE_PERMISSIONS.MAINTENANCE_MANAGER,
    );
    expect(getProfilePermissions('MAINTENANCE_STAFF')).toEqual(
      PROFILE_PERMISSIONS.MAINTENANCE_STAFF,
    );
  });

  it('no profile other than SUPER_ADMIN grants admin.account.manage', () => {
    for (const code of ADMIN_PROFILE_CODES) {
      if (code === 'SUPER_ADMIN') continue;
      expect(PROFILE_PERMISSIONS[code]).not.toContain('admin.account.manage');
    }
  });

  it('no profile other than SUPER_ADMIN grants pricing.policy.publish', () => {
    for (const code of ADMIN_PROFILE_CODES) {
      if (code === 'SUPER_ADMIN') continue;
      expect(PROFILE_PERMISSIONS[code]).not.toContain('pricing.policy.publish');
    }
  });

  it('SUPER_ADMIN is the only profile with full PERMISSIONS set', () => {
    for (const code of ADMIN_PROFILE_CODES) {
      if (code === 'SUPER_ADMIN') {
        expect(PROFILE_PERMISSIONS[code]).toEqual(PERMISSIONS);
      } else {
        expect(PROFILE_PERMISSIONS[code].length).toBeLessThan(PERMISSIONS.length);
      }
    }
  });
});
