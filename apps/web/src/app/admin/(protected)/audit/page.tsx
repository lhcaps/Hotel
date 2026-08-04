'use client';

import { useEffect, useState } from 'react';

import { adminApi } from '../../../../lib/admin-api';
import { translate } from '../../../../lib/i18n/messages';
import { useLocale } from '../../../../components/locale-provider';

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
    <main className="admin-page">
      <h1>{translate(locale, 'admin.audit')}</h1>
      <p>{translate(locale, 'admin.session')}</p>
      {error ? <p role="alert">{error}</p> : null}
      {items === undefined && error === undefined ? (
        <p>{translate(locale, 'admin.loading')}</p>
      ) : null}
      {items && items.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">{translate(locale, 'admin.time')}</th>
              <th scope="col">{translate(locale, 'admin.event')}</th>
              <th scope="col">{translate(locale, 'admin.actor')}</th>
              <th scope="col">{translate(locale, 'admin.payload')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.occurredAt}</td>
                <td>{item.eventType}</td>
                <td>{item.actorId ?? translate(locale, 'admin.system')}</td>
                <td>
                  <code>{JSON.stringify(item.payload)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
