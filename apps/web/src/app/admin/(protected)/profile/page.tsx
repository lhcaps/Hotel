'use client';

import { useEffect, useState } from 'react';
import type { AdminMe } from '@room/contracts';
import { Badge } from '../../../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';

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
    <main className="admin-page admin-page--narrow">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{translate(locale, 'admin.session')}</p>
          <h1>{translate(locale, 'admin.profileHeading')}</h1>
          <p>{translate(locale, 'admin.profileHelp')}</p>
        </div>
      </div>
      {error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {profile === undefined && error === undefined ? (
        <Card>
          <CardContent className="admin-state">{translate(locale, 'admin.loading')}</CardContent>
        </Card>
      ) : null}
      {profile ? (
        <>
          <div className="admin-profile-grid">
            <Card>
              <CardHeader>
                <CardTitle>{profile.displayName}</CardTitle>
                <CardDescription>{profile.emailMasked}</CardDescription>
              </CardHeader>
              <CardContent className="admin-profile-facts">
                <div>
                  <span>{translate(locale, 'admin.role')}</span>
                  <strong>{profile.profileLabelVi}</strong>
                </div>
                <div>
                  <span>{translate(locale, 'admin.status')}</span>
                  <Badge variant={profile.accountStatus === 'ACTIVE' ? 'secondary' : 'destructive'}>
                    {translate(
                      locale,
                      profile.accountStatus === 'ACTIVE'
                        ? 'admin.statusActive'
                        : 'admin.statusDisabled',
                    )}
                  </Badge>
                </div>
                <div>
                  <span>{translate(locale, 'admin.department')}</span>
                  <strong>
                    {profile.department?.name ?? translate(locale, 'admin.noDepartments')}
                  </strong>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{translate(locale, 'admin.sessionScope')}</CardTitle>
                <CardDescription>{translate(locale, 'admin.sessionScopeHelp')}</CardDescription>
              </CardHeader>
              <CardContent className="admin-permission-list">
                {profile.profileCode === 'ROOM_STATUS_VIEWER' ? (
                  <p>{translate(locale, 'admin.readOnlyScope')}</p>
                ) : (
                  <ul>
                    {profile.permissions.map((permission) => (
                      <li key={permission}>{permission}</li>
                    ))}
                  </ul>
                )}
                <p className="admin-muted">
                  {translate(locale, 'admin.sessionExpiresAt', {
                    time: new Date(profile.sessionExpiresAt).toLocaleString(locale),
                  })}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="admin-page-actions">
            <SessionLogoutButton redirectTo="/admin/login" />
          </div>
        </>
      ) : null}
    </main>
  );
}
