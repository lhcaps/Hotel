'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
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

type AdminProfileCode = 'SUPER_ADMIN' | 'ROOM_STATUS_VIEWER';
const profileOptions: readonly { readonly value: AdminProfileCode; readonly label: MessageKey }[] =
  [
    { value: 'SUPER_ADMIN', label: 'admin.roleSuperAdmin' },
    { value: 'ROOM_STATUS_VIEWER', label: 'admin.roleRoomStatusViewer' },
  ];
type AccountDraft = { readonly role: AdminProfileCode; readonly departmentIds: readonly string[] };

export default function AdminAccountsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminApi.listAdminAccounts>>>();
  const [customers, setCustomers] =
    useState<Awaited<ReturnType<typeof adminApi.listCustomerAccounts>>>();
  const [departments, setDepartments] = useState<
    Awaited<ReturnType<typeof adminApi.listAdminDepartments>>
  >([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [me, setMe] = useState<Awaited<ReturnType<typeof adminApi.me>>>();
  const [drafts, setDrafts] = useState<Record<string, AccountDraft>>({});
  const [createForm, setCreateForm] = useState<{
    displayName: string;
    email: string;
    password: string;
    role: AdminProfileCode;
    departmentIds: string[];
  }>({ displayName: '', email: '', password: '', role: 'ROOM_STATUS_VIEWER', departmentIds: [] });
  const [createMessage, setCreateMessage] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [accounts, customerAccounts, current, availableDepartments] = await Promise.all([
        adminApi.listAdminAccounts(),
        adminApi.listCustomerAccounts(),
        adminApi.me(),
        adminApi.listAdminDepartments(),
      ]);
      setItems(accounts);
      setCustomers(customerAccounts);
      setMe(current);
      setDepartments(availableDepartments);
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

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending('create');
    setCreateMessage(undefined);
    try {
      await adminApi.createAdminAccount(createForm);
      setCreateForm({
        displayName: '',
        email: '',
        password: '',
        role: 'ROOM_STATUS_VIEWER',
        departmentIds: [],
      });
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

  function draftFor(item: NonNullable<typeof items>[number]): AccountDraft {
    return (
      drafts[item.id] ?? {
        role: item.profileCode ?? 'ROOM_STATUS_VIEWER',
        departmentIds: departments
          .filter((department) => item.departments.includes(department.name))
          .map((department) => department.id),
      }
    );
  }

  function updateDraft(id: string, patch: Partial<AccountDraft>) {
    const current = items?.find((item) => item.id === id);
    if (current === undefined) return;
    setDrafts((value) => ({ ...value, [id]: { ...draftFor(current), ...patch } }));
  }

  async function saveAssignment(id: string) {
    const item = items?.find((candidate) => candidate.id === id);
    if (item === undefined) return;
    const draft = draftFor(item);
    if (draft.departmentIds.length === 0) {
      setError(translate(locale, 'admin.departmentsRequired'));
      return;
    }
    setPending(id);
    try {
      const updated = await adminApi.updateAdminAccount(id, draft);
      setItems((current) =>
        current?.map((candidate) => (candidate.id === id ? updated : candidate)),
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(undefined);
    }
  }

  async function changeStatus(id: string, status: 'ACTIVE' | 'DISABLED', customer = false) {
    setPending(id);
    try {
      if (customer) {
        const updated = await adminApi.updateCustomerAccount(id, { status });
        setCustomers((current) => current?.map((item) => (item.id === id ? updated : item)));
      } else {
        const updated = await adminApi.updateAdminAccount(id, { status });
        setItems((current) => current?.map((item) => (item.id === id ? updated : item)));
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(undefined);
    }
  }

  async function revokeSessions(id: string, customer = false) {
    setPending(id);
    try {
      if (customer) await adminApi.revokeCustomerSessions(id);
      else await adminApi.revokeAdminSessions(id);
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
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{translate(locale, 'admin.accessManagement')}</p>
          <h1>{translate(locale, 'admin.accounts')}</h1>
          <p>{translate(locale, 'admin.accessManagementHelp')}</p>
        </div>
        <Badge variant="outline">
          {translate(locale, 'admin.adminProfilesCount', { count: items?.length ?? 0 })}
        </Badge>
      </div>
      <nav className="admin-tabs" aria-label={translate(locale, 'admin.accountType')}>
        <a aria-current="page" href="#admin-accounts">
          {translate(locale, 'admin.adminAccounts')}
        </a>
        <a href="#customer-accounts">{translate(locale, 'admin.customerAccounts')}</a>
      </nav>
      {error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      ) : null}

      {me?.profileCode === 'SUPER_ADMIN' ? (
        <Card className="admin-create-card">
          <CardHeader>
            <CardTitle>{translate(locale, 'admin.createAccount')}</CardTitle>
            <CardDescription>{translate(locale, 'admin.createAccountHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="admin-form-grid" onSubmit={(event) => void createAccount(event)}>
              <label>
                {translate(locale, 'admin.displayName')}
                <Input
                  required
                  value={createForm.displayName}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                />
              </label>
              <label>
                Email
                <Input
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
                <Input
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
                {translate(locale, 'admin.profile')}
                <select
                  required
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      role: event.target.value as AdminProfileCode,
                    }))
                  }
                >
                  {profileOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {translate(locale, option.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {translate(locale, 'admin.department')}
                <select
                  required
                  multiple
                  value={createForm.departmentIds}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      departmentIds: Array.from(
                        event.target.selectedOptions,
                        (option) => option.value,
                      ),
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
              <div className="admin-form-actions">
                <Button disabled={pending !== undefined} type="submit">
                  {pending === 'create'
                    ? translate(locale, 'admin.creating')
                    : translate(locale, 'admin.create')}
                </Button>
                {createMessage ? <span role="status">{createMessage}</span> : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card id="admin-accounts">
        <CardHeader>
          <CardTitle>{translate(locale, 'admin.adminAccounts')}</CardTitle>
          <CardDescription>{translate(locale, 'admin.legacyAdminHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          {items === undefined ? (
            <p className="admin-state">{translate(locale, 'admin.loading')}</p>
          ) : items.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noAccounts')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate(locale, 'admin.user')}</TableHead>
                  <TableHead>{translate(locale, 'admin.profile')}</TableHead>
                  <TableHead>{translate(locale, 'admin.department')}</TableHead>
                  <TableHead>{translate(locale, 'admin.status')}</TableHead>
                  <TableHead>{translate(locale, 'admin.sessions')}</TableHead>
                  <TableHead>{translate(locale, 'admin.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const draft = draftFor(item);
                  const dirty = drafts[item.id] !== undefined;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <strong>{item.displayName}</strong>
                        <br />
                        <span className="admin-muted">{item.emailMasked}</span>
                      </TableCell>
                      <TableCell>
                        <select
                          aria-label={translate(locale, 'admin.profileFor', {
                            email: item.emailMasked,
                          })}
                          value={draft.role}
                          onChange={(event) =>
                            updateDraft(item.id, { role: event.target.value as AdminProfileCode })
                          }
                        >
                          {profileOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {translate(locale, option.label)}
                            </option>
                          ))}
                        </select>
                        {item.profileCode === null ? (
                          <Badge variant="destructive">
                            {translate(locale, 'admin.needsAssignment')}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <select
                          aria-label={translate(locale, 'admin.departmentFor', {
                            email: item.emailMasked,
                          })}
                          multiple
                          required
                          value={draft.departmentIds as string[]}
                          onChange={(event) =>
                            updateDraft(item.id, {
                              departmentIds: Array.from(
                                event.target.selectedOptions,
                                (option) => option.value,
                              ),
                            })
                          }
                        >
                          {departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'ACTIVE' ? 'secondary' : 'destructive'}>
                          {translate(
                            locale,
                            item.status === 'ACTIVE'
                              ? 'admin.statusActive'
                              : 'admin.statusDisabled',
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.activeSessionCount}</TableCell>
                      <TableCell>
                        <div className="admin-row-actions">
                          {dirty ? (
                            <Button
                              disabled={pending !== undefined}
                              onClick={() => void saveAssignment(item.id)}
                              size="sm"
                            >
                              {translate(locale, 'admin.saveProfile')}
                            </Button>
                          ) : null}
                          <Button
                            disabled={pending !== undefined}
                            onClick={() =>
                              void changeStatus(
                                item.id,
                                item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                              )
                            }
                            size="sm"
                            variant="outline"
                          >
                            {translate(
                              locale,
                              item.status === 'ACTIVE'
                                ? 'admin.lockAccount'
                                : 'admin.unlockAccount',
                            )}
                          </Button>
                          <Button
                            disabled={pending !== undefined || item.activeSessionCount === 0}
                            onClick={() => void revokeSessions(item.id)}
                            size="sm"
                            variant="ghost"
                          >
                            {translate(locale, 'admin.revokeSessions')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card id="customer-accounts">
        <CardHeader>
          <CardTitle>{translate(locale, 'admin.customerAccounts')}</CardTitle>
          <CardDescription>{translate(locale, 'admin.customerAccountsHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          {customers === undefined ? (
            <p className="admin-state">{translate(locale, 'admin.loading')}</p>
          ) : customers.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noCustomerAccounts')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate(locale, 'admin.reportCustomers')}</TableHead>
                  <TableHead>{translate(locale, 'admin.identityProviders')}</TableHead>
                  <TableHead>{translate(locale, 'admin.bookingCount')}</TableHead>
                  <TableHead>{translate(locale, 'admin.status')}</TableHead>
                  <TableHead>{translate(locale, 'admin.sessions')}</TableHead>
                  <TableHead>{translate(locale, 'admin.lastActivity')}</TableHead>
                  <TableHead>{translate(locale, 'admin.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <strong>{item.displayName}</strong>
                      <br />
                      <span className="admin-muted">{item.emailMasked}</span>
                    </TableCell>
                    <TableCell>
                      {item.providers.join(', ') || translate(locale, 'admin.notLinked')}
                    </TableCell>
                    <TableCell>{item.bookingCount}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'ACTIVE' ? 'secondary' : 'destructive'}>
                        {translate(
                          locale,
                          item.status === 'ACTIVE' ? 'admin.statusActive' : 'admin.statusDisabled',
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.activeSessionCount}</TableCell>
                    <TableCell>
                      {item.lastActivityAt === null
                        ? translate(locale, 'admin.noActivity')
                        : formatDateTime(locale, item.lastActivityAt)}
                    </TableCell>
                    <TableCell>
                      <div className="admin-row-actions">
                        <Button
                          disabled={pending !== undefined}
                          onClick={() =>
                            void changeStatus(
                              item.id,
                              item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                              true,
                            )
                          }
                          size="sm"
                          variant="outline"
                        >
                          {translate(
                            locale,
                            item.status === 'ACTIVE' ? 'admin.lockAccount' : 'admin.unlockAccount',
                          )}
                        </Button>
                        <Button
                          disabled={pending !== undefined || item.activeSessionCount === 0}
                          onClick={() => void revokeSessions(item.id, true)}
                          size="sm"
                          variant="ghost"
                        >
                          {translate(locale, 'admin.revokeSessions')}
                        </Button>
                        <Link
                          href={`/admin/bookings?customerUserId=${encodeURIComponent(item.id)}`}
                        >
                          {translate(locale, 'admin.viewBookings')}
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
