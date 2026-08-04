import { describe, expect, it } from 'vitest';

import { hasPermissions, PERMISSIONS, ROLE_PERMISSIONS } from '../src/permissions.js';

describe('Phase 3 permissions', () => {
  it('grants every catalog and audit permission only to ADMIN', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('catalog.maintenance.manage');
    expect(ROLE_PERMISSIONS.ADMIN).toContain('audit.read');
    expect(ROLE_PERMISSIONS.ADMIN).toContain('pricing.rate_plan.manage');
    expect(ROLE_PERMISSIONS.CUSTOMER).toEqual([]);
    expect(
      hasPermissions('ADMIN', ['catalog.room.manage', 'audit.read', 'pricing.rate_plan.read']),
    ).toBe(true);
    expect(hasPermissions('CUSTOMER', ['catalog.room.read'])).toBe(false);
  });
});

describe('Phase 8B.1 payment reconciliation permissions', () => {
  it('includes payment.reconciliation.read and payment.reconciliation.manage in PERMISSIONS', () => {
    expect(PERMISSIONS).toContain('payment.reconciliation.read');
    expect(PERMISSIONS).toContain('payment.reconciliation.manage');
  });

  it('grants payment reconciliation permissions only to ADMIN', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('payment.reconciliation.read');
    expect(ROLE_PERMISSIONS.ADMIN).toContain('payment.reconciliation.manage');
    expect(ROLE_PERMISSIONS.CUSTOMER).not.toContain('payment.reconciliation.read');
    expect(ROLE_PERMISSIONS.CUSTOMER).not.toContain('payment.reconciliation.manage');
    expect(
      hasPermissions('ADMIN', ['payment.reconciliation.read', 'payment.reconciliation.manage']),
    ).toBe(true);
    expect(hasPermissions('CUSTOMER', ['payment.reconciliation.read'])).toBe(false);
    expect(hasPermissions('CUSTOMER', ['payment.reconciliation.manage'])).toBe(false);
  });

  it('keeps room status viewing read-only and reserves account management for super admins', () => {
    expect(ROLE_PERMISSIONS.ROOM_STATUS_VIEWER).toEqual([
      'catalog.property.read',
      'catalog.room.read',
      'catalog.room.status.read',
    ]);
    expect(hasPermissions('ROOM_STATUS_VIEWER', ['catalog.room.status.read'])).toBe(true);
    expect(hasPermissions('ROOM_STATUS_VIEWER', ['catalog.room.manage'])).toBe(false);
    expect(hasPermissions('ROOM_STATUS_VIEWER', ['admin.account.read'])).toBe(false);
    expect(hasPermissions('SUPER_ADMIN', ['admin.account.manage', 'admin.audit.read'])).toBe(true);
  });
});
