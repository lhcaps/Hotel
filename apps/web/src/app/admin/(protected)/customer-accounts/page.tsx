'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { useLocale } from '../../../../components/locale-provider';
import { adminApi } from '../../../../lib/admin-api';
import { formatDateTime, translate } from '../../../../lib/i18n/messages';

export default function AdminCustomerAccountsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminApi.listCustomerAccounts>>>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<string>();

  const load = useCallback(async () => {
    try {
      setItems(await adminApi.listCustomerAccounts());
      setError(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: 'ACTIVE' | 'DISABLED') {
    setPending(id);
    try {
      const updated = await adminApi.updateCustomerAccount(id, { status });
      setItems((current) => current?.map((item) => (item.id === id ? updated : item)));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(undefined);
    }
  }

  async function revokeSessions(id: string) {
    setPending(id);
    try {
      await adminApi.revokeCustomerSessions(id);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(undefined);
    }
  }

  return (
    <main className="admin-page">
      <h1>{translate(locale, 'admin.customerAccounts')}</h1>
      <p>{translate(locale, 'admin.customerAccountsHelp')}</p>
      {error ? <p role="alert">{error}</p> : null}
      {items === undefined ? <p>{translate(locale, 'admin.loading')}</p> : null}
      {items?.length === 0 ? <p>{translate(locale, 'admin.noCustomerAccounts')}</p> : null}
      {items && items.length > 0 ? (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th scope="col">{translate(locale, 'admin.profile')}</th>
                <th scope="col">{translate(locale, 'admin.emailMasked')}</th>
                <th scope="col">{translate(locale, 'admin.identityProviders')}</th>
                <th scope="col">{translate(locale, 'admin.status')}</th>
                <th scope="col">{translate(locale, 'admin.bookingCount')}</th>
                <th scope="col">{translate(locale, 'admin.activeSessions')}</th>
                <th scope="col">{translate(locale, 'admin.lastActivity')}</th>
                <th scope="col">{translate(locale, 'admin.action')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const nextStatus = item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
                return (
                  <tr key={item.id}>
                    <td>{item.displayName}</td>
                    <td>{item.emailMasked}</td>
                    <td>{item.providers.join(', ') || '—'}</td>
                    <td>{item.status}</td>
                    <td>{item.bookingCount}</td>
                    <td>{item.activeSessionCount}</td>
                    <td>
                      {item.lastActivityAt === null
                        ? '—'
                        : formatDateTime(locale, item.lastActivityAt)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          aria-label={`${translate(
                            locale,
                            nextStatus === 'ACTIVE' ? 'admin.unlockAccount' : 'admin.lockAccount',
                          )} ${item.emailMasked}`}
                          disabled={pending !== undefined}
                          onClick={() => void updateStatus(item.id, nextStatus)}
                          type="button"
                        >
                          {translate(
                            locale,
                            nextStatus === 'ACTIVE' ? 'admin.unlockAccount' : 'admin.lockAccount',
                          )}
                        </button>
                        <button
                          aria-label={`${translate(locale, 'admin.revokeSessions')} ${item.emailMasked}`}
                          disabled={pending !== undefined || item.activeSessionCount === 0}
                          onClick={() => void revokeSessions(item.id)}
                          type="button"
                        >
                          {translate(locale, 'admin.revokeSessions')}
                        </button>
                        <Link
                          href={`/admin/bookings?customerUserId=${encodeURIComponent(item.id)}`}
                        >
                          {translate(locale, 'admin.viewBookings')}
                        </Link>
                        <Link href="/admin/audit">{translate(locale, 'admin.viewAudit')}</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
