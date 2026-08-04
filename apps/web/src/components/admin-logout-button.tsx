'use client';

import { SessionLogoutButton } from './session-logout-button';

export function AdminLogoutButton() {
  return (
    <div className="admin-logout-button">
      <SessionLogoutButton redirectTo="/admin/login" />
    </div>
  );
}
