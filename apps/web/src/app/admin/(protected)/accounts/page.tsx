'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

import { adminApi } from '../../../../lib/admin-api';
import { translate } from '../../../../lib/i18n/messages';
import { useLocale } from '../../../../components/locale-provider';

export default function AdminAccountsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminApi.listAdminAccounts>>>();
  const [departments, setDepartments] = useState<
    Awaited<ReturnType<typeof adminApi.listAdminDepartments>>
  >([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [me, setMe] = useState<Awaited<ReturnType<typeof adminApi.me>>>();
  const [createForm, setCreateForm] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'ADMIN',
    departmentIds: [] as string[],
  });
  const [createMessage, setCreateMessage] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [accounts, current, availableDepartments] = await Promise.all([
        adminApi.listAdminAccounts(),
        adminApi.me(),
        adminApi.listAdminDepartments(),
      ]);
      setItems(accounts);
      setMe(current);
      setDepartments(availableDepartments);
      setError(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    }
  }, [locale]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending('create');
    setCreateMessage(undefined);
    try {
      await adminApi.createAdminAccount(createForm);
      setCreateForm({ displayName: '', email: '', password: '', role: 'ADMIN', departmentIds: [] });
      setCreateMessage(translate(locale, 'admin.accountCreated'));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(undefined);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(id: string, role: string) {
    setPending(id);
    try {
      const updated = await adminApi.updateAdminAccount(id, { role });
      setItems((current) => current?.map((item) => (item.id === id ? updated : item)));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(undefined);
    }
  }

  async function changeStatus(id: string, status: 'ACTIVE' | 'DISABLED') {
    setPending(id);
    try {
      const updated = await adminApi.updateAdminAccount(id, { status });
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
      await adminApi.revokeAdminSessions(id);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(undefined);
    }
  }

  async function changeDepartments(id: string, departmentIds: readonly string[]) {
    setPending(id);
    try {
      const updated = await adminApi.updateAdminAccount(id, { departmentIds });
      setItems((current) => current?.map((item) => (item.id === id ? updated : item)));
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
      <h1>{translate(locale, 'admin.accounts')}</h1>
      <p>{translate(locale, 'admin.session')}</p>
      {me?.role === 'SUPER_ADMIN' ? (
        <form onSubmit={(event) => void createAccount(event)}>
          <h2>{translate(locale, 'admin.createAccount')}</h2>
          <p>{translate(locale, 'admin.createAccountHelp')}</p>
          <label>
            {translate(locale, 'admin.displayName')}
            <input
              required
              value={createForm.displayName}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, displayName: event.target.value }))
              }
            />
          </label>
          <label>
            {translate(locale, 'admin.email')}
            <input
              required
              type="email"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label>
            {translate(locale, 'admin.password')}
            <input
              required
              minLength={8}
              type="password"
              value={createForm.password}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>
          <label>
            {translate(locale, 'admin.role')}
            <select
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, role: event.target.value }))
              }
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="ROOM_STATUS_VIEWER">ROOM_STATUS_VIEWER</option>
            </select>
          </label>
          <label>
            {translate(locale, 'admin.department')}
            <select
              multiple
              value={createForm.departmentIds}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  departmentIds: Array.from(event.target.selectedOptions, (option) => option.value),
                }))
              }
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={pending !== undefined} type="submit">
            {pending === 'create'
              ? translate(locale, 'admin.creating')
              : translate(locale, 'admin.create')}
          </button>
          {createMessage ? <p role="status">{createMessage}</p> : null}
        </form>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {items === undefined ? <p>{translate(locale, 'admin.loading')}</p> : null}
      {items?.length === 0 ? <p>{translate(locale, 'admin.noAccounts')}</p> : null}
      {items && items.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">{translate(locale, 'admin.profile')}</th>
              <th scope="col">{translate(locale, 'admin.emailMasked')}</th>
              <th scope="col">{translate(locale, 'admin.role')}</th>
              <th scope="col">{translate(locale, 'admin.department')}</th>
              <th scope="col">{translate(locale, 'admin.status')}</th>
              <th scope="col">{translate(locale, 'admin.sessions')}</th>
              <th scope="col">{translate(locale, 'admin.lastActivity')}</th>
              <th scope="col">{translate(locale, 'admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.displayName}</td>
                <td>{item.emailMasked}</td>
                <td>
                  <select
                    aria-label={`${translate(locale, 'admin.role')} ${item.emailMasked}`}
                    disabled={pending !== undefined}
                    onChange={(event) => void changeRole(item.id, event.target.value)}
                    value={item.role}
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="ROOM_STATUS_VIEWER">ROOM_STATUS_VIEWER</option>
                    <option value="ADMIN">ADMIN (legacy)</option>
                  </select>
                </td>
                <td>
                  <select
                    aria-label={`${translate(locale, 'admin.assignDepartments')} ${item.emailMasked}`}
                    disabled={pending !== undefined}
                    multiple
                    onChange={(event) =>
                      void changeDepartments(
                        item.id,
                        Array.from(event.target.selectedOptions, (option) => option.value),
                      )
                    }
                    value={departments
                      .filter((department) => item.departments.includes(department.name))
                      .map((department) => department.id)}
                  >
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{item.status}</td>
                <td>{item.activeSessionCount}</td>
                <td>
                  {item.lastActivityAt === null
                    ? '—'
                    : new Date(item.lastActivityAt).toLocaleString(locale)}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={pending !== undefined}
                      onClick={() =>
                        void changeStatus(item.id, item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')
                      }
                      type="button"
                    >
                      {item.status === 'ACTIVE'
                        ? translate(locale, 'admin.lockAccount')
                        : translate(locale, 'admin.unlockAccount')}
                    </button>
                    <button
                      disabled={pending !== undefined || item.activeSessionCount === 0}
                      onClick={() => void revokeSessions(item.id)}
                      type="button"
                    >
                      {translate(locale, 'admin.revokeAdminSessions')}
                    </button>
                    <Link href="/admin/audit">{translate(locale, 'admin.viewAudit')}</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
