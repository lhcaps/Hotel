import { describe, expect, it } from 'vitest';

import {
  ADMIN_PROFILE_CODES,
  ADMIN_PROFILE_LABELS_VI,
  hasPermissions,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../src/permissions.js';

describe('Phase 3 permissions', () => {
  it('exposes exactly the two scoped administrator profiles', () => {
    expect(ADMIN_PROFILE_CODES).toEqual(['SUPER_ADMIN', 'ROOM_STATUS_VIEWER']);
    expect(ADMIN_PROFILE_LABELS_VI).toEqual({
      SUPER_ADMIN: 'Tổng quản trị',
      ROOM_STATUS_VIEWER: 'Nhân viên theo dõi phòng',
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
