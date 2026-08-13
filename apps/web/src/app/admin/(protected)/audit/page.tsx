'use client';

import { useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table';
import { useLocale } from '../../../../components/locale-provider';
import { adminApi } from '../../../../lib/admin-api';
import { formatDateTime, translate, type MessageKey } from '../../../../lib/i18n/messages';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
} from '../../../../components/admin/admin-ui';

const eventLabels: Readonly<Record<string, MessageKey>> = {
  ADMIN_ACCOUNT_CREATED: 'admin.eventAdminAccountCreated',
  ADMIN_ACCOUNT_UPDATED: 'admin.eventAdminAccountUpdated',
  ADMIN_DEPARTMENT_CREATED: 'admin.eventAdminDepartmentCreated',
  ADMIN_SESSIONS_REVOKED: 'admin.eventAdminSessionsRevoked',
};

export default function AdminAuditPage() {
  const locale = useLocale();
  const [items, setItems] =
    useState<Awaited<ReturnType<typeof adminApi.listAdminAudit>>['items']>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void adminApi
      .listAdminAudit()
      .then((response) => setItems(response.items))
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
        ),
      );
  }, [locale]);

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow={translate(locale, 'admin.auditScope')}
        title={translate(locale, 'admin.audit')}
        description={translate(locale, 'admin.auditHelp')}
      />
      {error ? (
        <AdminErrorState title={translate(locale, 'admin.loadErrorHeading')} description={error} />
      ) : null}
      {items === undefined && error === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loading')} />
      ) : null}
      {items !== undefined ? (
        <Card>
          <CardHeader>
            <CardTitle>{translate(locale, 'admin.recentHistory')}</CardTitle>
            <CardDescription>{translate(locale, 'admin.recentHistoryHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <AdminEmptyState title={translate(locale, 'admin.noEvents')} />
            ) : (
              <AdminDataTable variant="audit">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate(locale, 'admin.time')}</TableHead>
                      <TableHead>{translate(locale, 'admin.event')}</TableHead>
                      <TableHead>{translate(locale, 'admin.actor')}</TableHead>
                      <TableHead>{translate(locale, 'admin.scope')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const eventLabel = eventLabels[item.eventType];
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{formatDateTime(locale, item.occurredAt)}</TableCell>
                          <TableCell>
                            {eventLabel === undefined
                              ? translate(locale, 'admin.adminActivity')
                              : translate(locale, eventLabel)}
                          </TableCell>
                          <TableCell>
                            {item.actorName ?? translate(locale, 'admin.system')}
                          </TableCell>
                          <TableCell>{translate(locale, 'admin.permissions')}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AdminDataTable>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
