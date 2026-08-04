'use client';

import { useEffect, useState } from 'react';
import type { AdminMe } from '@room/contracts';

import { useLocale } from '../../../../components/locale-provider';
import { adminApi } from '../../../../lib/admin-api';
import { translate } from '../../../../lib/i18n/messages';
import { SessionLogoutButton } from '../../../../components/session-logout-button';

export default function AdminProfilePage() {
  const locale = useLocale();
  const [profile, setProfile] = useState<AdminMe>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void adminApi
      .me()
      .then(setProfile)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
        ),
      );
  }, [locale]);

  return (
    <main className="admin-page">
      <h1>{translate(locale, 'admin.profileHeading')}</h1>
      <p>{translate(locale, 'admin.profileHelp')}</p>
      {error ? <p role="alert">{error}</p> : null}
      {profile === undefined && error === undefined ? (
        <p>{translate(locale, 'admin.loading')}</p>
      ) : null}
      {profile ? (
        <>
          <dl>
            <dt>{translate(locale, 'admin.displayName')}</dt>
            <dd>{profile.displayName}</dd>
            <dt>{translate(locale, 'admin.email')}</dt>
            <dd>{profile.emailMasked}</dd>
            <dt>{translate(locale, 'admin.role')}</dt>
            <dd>
              {profile.role === 'SUPER_ADMIN'
                ? translate(locale, 'admin.roleSuperAdmin')
                : profile.role === 'ROOM_STATUS_VIEWER'
                  ? translate(locale, 'admin.roleRoomStatusViewer')
                  : 'ADMIN'}
            </dd>
            <dt>{translate(locale, 'admin.department')}</dt>
            <dd>{profile.departments?.join(', ') || translate(locale, 'admin.noDepartments')}</dd>
            <dt>{translate(locale, 'admin.permissions')}</dt>
            <dd>
              {profile.role === 'ROOM_STATUS_VIEWER'
                ? translate(locale, 'admin.readOnlyScope')
                : profile.permissions.join(', ')}
            </dd>
            <dt>{translate(locale, 'admin.session')}</dt>
            <dd>{profile.sessionExpiresAt}</dd>
          </dl>
          <SessionLogoutButton redirectTo="/admin/login" />
        </>
      ) : null}
    </main>
  );
}
