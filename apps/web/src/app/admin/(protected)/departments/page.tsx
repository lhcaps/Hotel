'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { adminApi } from '../../../../lib/admin-api';
import { translate } from '../../../../lib/i18n/messages';
import { useLocale } from '../../../../components/locale-provider';

export default function AdminDepartmentsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminApi.listAdminDepartments>>>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setItems(await adminApi.listAdminDepartments());
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

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await adminApi.createAdminDepartment({ code, name });
      setItems((current) => [...(current ?? []), created]);
      setCode('');
      setName('');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    }
  }

  return (
    <main className="admin-page">
      <h1>{translate(locale, 'admin.departments')}</h1>
      <p>{translate(locale, 'admin.session')}</p>
      <form onSubmit={create}>
        <label>
          {translate(locale, 'admin.departmentCode')}
          <input onChange={(event) => setCode(event.target.value)} required value={code} />
        </label>
        <label>
          {translate(locale, 'admin.departmentName')}
          <input onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <button type="submit">{translate(locale, 'admin.createDepartment')}</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {items === undefined ? <p>{translate(locale, 'admin.loading')}</p> : null}
      {items && items.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">{translate(locale, 'admin.departmentCode')}</th>
              <th scope="col">{translate(locale, 'admin.departmentName')}</th>
              <th scope="col">{translate(locale, 'admin.members')}</th>
              <th scope="col">{translate(locale, 'admin.status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.memberCount}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
