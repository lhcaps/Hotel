'use client';

import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { useSessionLogout } from './session-logout-button';
import { DropdownMenuItem } from './ui/dropdown-menu';

export function AdminLogoutButton() {
  const locale = useLocale();
  const { logout, pending } = useSessionLogout('/admin/login');
  return (
    <DropdownMenuItem disabled={pending} onClick={() => void logout()}>
      {pending ? translate(locale, 'profile.loggingOut') : translate(locale, 'public.logout')}
    </DropdownMenuItem>
  );
}
