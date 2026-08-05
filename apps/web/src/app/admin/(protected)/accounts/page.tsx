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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
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
  AdminFilterToolbar,
  AdminFormSheet,
  AdminMultiSelect,
  AdminPageHeader,
  AdminStatusBadge,
} from '../../../../components/admin/admin-ui';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string>();
  const [query, setQuery] = useState('');

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
      setCreateOpen(false);
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

  async function saveAssignment(id: string): Promise<boolean> {
    const item = items?.find((candidate) => candidate.id === id);
    if (item === undefined) return false;
    const draft = draftFor(item);
    if (draft.departmentIds.length === 0) {
      setError(translate(locale, 'admin.departmentsRequired'));
      return false;
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
      return false;
    } finally {
      setPending(undefined);
    }
    return true;
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

  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visibleItems = items?.filter((item) =>
    [item.displayName, item.emailMasked, item.profileCode ?? '', ...item.departments]
      .join(' ')
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery),
  );
  const visibleCustomers = customers?.filter((item) =>
    [item.displayName, item.emailMasked, ...item.providers]
      .join(' ')
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery),
  );

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow={translate(locale, 'admin.accessManagement')}
        title={translate(locale, 'admin.accounts')}
        description={translate(locale, 'admin.accessManagementHelp')}
        actions={
          <div className="admin-page-header__actions">
            <Badge variant="outline">
              {translate(locale, 'admin.adminProfilesCount', { count: items?.length ?? 0 })}
            </Badge>
            {me?.profileCode === 'SUPER_ADMIN' ? (
              <Button onClick={() => setCreateOpen(true)}>
                {translate(locale, 'admin.createAccount')}
              </Button>
            ) : null}
          </div>
        }
      />
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
      <AdminFilterToolbar>
        <label>
          {translate(locale, 'admin.search')}
          <Input
            type="search"
            placeholder={translate(locale, 'admin.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="admin-filter-toolbar__summary">
          {translate(locale, 'admin.adminProfilesCount', {
            count: visibleItems?.length ?? 0,
          })}
          {' · '}
          {translate(locale, 'admin.customerAccounts')}: {visibleCustomers?.length ?? 0}
        </div>
      </AdminFilterToolbar>

      {me?.profileCode === 'SUPER_ADMIN' ? (
        <AdminFormSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          title={translate(locale, 'admin.createAccount')}
          description={translate(locale, 'admin.createAccountHelp')}
          footer={createMessage ? <span role="status">{createMessage}</span> : null}
        >
          <form
            autoComplete="off"
            className="admin-form-stack"
            onSubmit={(event) => void createAccount(event)}
          >
            <label>
              {translate(locale, 'admin.displayName')}
              <Input
                autoComplete="off"
                name="new-admin-display-name"
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
                autoComplete="off"
                name="new-admin-email"
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
                autoComplete="new-password"
                name="new-admin-password"
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
              <Select
                value={createForm.role}
                onValueChange={(value) => {
                  if (value === null) return;
                  setCreateForm((current) => ({ ...current, role: value as AdminProfileCode }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {profileOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {translate(locale, option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              {translate(locale, 'admin.department')}
              <AdminMultiSelect
                ariaLabel={translate(locale, 'admin.department')}
                options={departments.map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
                value={createForm.departmentIds}
                onChange={(departmentIds) =>
                  setCreateForm((current) => ({ ...current, departmentIds: [...departmentIds] }))
                }
                placeholder={translate(locale, 'admin.department')}
              />
            </label>
            <Button disabled={pending !== undefined} type="submit">
              {pending === 'create'
                ? translate(locale, 'admin.creating')
                : translate(locale, 'admin.create')}
            </Button>
          </form>
        </AdminFormSheet>
      ) : null}

      {editAccountId !== undefined
        ? (() => {
            const item = items?.find((candidate) => candidate.id === editAccountId);
            if (item === undefined) return null;
            const draft = draftFor(item);
            return (
              <AdminFormSheet
                open
                onOpenChange={(open) => {
                  if (!open) setEditAccountId(undefined);
                }}
                title={translate(locale, 'admin.profile')}
                description={item.emailMasked}
                footer={
                  <Button
                    disabled={pending !== undefined}
                    onClick={() =>
                      void saveAssignment(item.id).then((saved) => {
                        if (saved) setEditAccountId(undefined);
                      })
                    }
                  >
                    {pending === item.id
                      ? translate(locale, 'admin.saving')
                      : translate(locale, 'admin.saveProfile')}
                  </Button>
                }
              >
                <div className="admin-form-stack">
                  <label>
                    {translate(locale, 'admin.profile')}
                    <Select
                      value={draft.role}
                      onValueChange={(value) => {
                        if (value !== null)
                          updateDraft(item.id, { role: value as AdminProfileCode });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {profileOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {translate(locale, option.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    {translate(locale, 'admin.department')}
                    <AdminMultiSelect
                      ariaLabel={translate(locale, 'admin.departmentFor', {
                        email: item.emailMasked,
                      })}
                      options={departments.map((department) => ({
                        value: department.id,
                        label: department.name,
                      }))}
                      value={draft.departmentIds}
                      onChange={(departmentIds) => updateDraft(item.id, { departmentIds })}
                      placeholder={translate(locale, 'admin.department')}
                    />
                  </label>
                </div>
              </AdminFormSheet>
            );
          })()
        : null}

      <Card id="admin-accounts">
        <CardHeader>
          <CardTitle>{translate(locale, 'admin.adminAccounts')}</CardTitle>
          <CardDescription>{translate(locale, 'admin.legacyAdminHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          {items === undefined ? (
            <p className="admin-state">{translate(locale, 'admin.loading')}</p>
          ) : visibleItems?.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noAccounts')}</p>
          ) : (
            <AdminDataTable className="admin-accounts-table">
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
                  {visibleItems?.map((item) => {
                    const draft = draftFor(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell data-label={translate(locale, 'admin.user')}>
                          <strong>{item.displayName}</strong>
                          <br />
                          <span className="admin-muted">{item.emailMasked}</span>
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.profile')}>
                          <span>
                            {translate(
                              locale,
                              profileOptions.find((option) => option.value === draft.role)?.label ??
                                'admin.roleRoomStatusViewer',
                            )}
                          </span>
                          {item.profileCode === null ? (
                            <Badge variant="destructive">
                              {translate(locale, 'admin.needsAssignment')}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.department')}>
                          {item.departments.join(', ') || translate(locale, 'account.notAvailable')}
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.status')}>
                          <AdminStatusBadge tone={item.status === 'ACTIVE' ? 'success' : 'danger'}>
                            {translate(
                              locale,
                              item.status === 'ACTIVE'
                                ? 'admin.statusActive'
                                : 'admin.statusDisabled',
                            )}
                          </AdminStatusBadge>
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.sessions')}>
                          {item.activeSessionCount}
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.action')}>
                          <div className="admin-row-actions">
                            <Button
                              disabled={pending !== undefined}
                              onClick={() => setEditAccountId(item.id)}
                              size="sm"
                              variant="outline"
                            >
                              {translate(locale, 'admin.profile')}
                            </Button>
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
            </AdminDataTable>
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
          ) : visibleCustomers?.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noCustomerAccounts')}</p>
          ) : (
            <AdminDataTable className="admin-customer-accounts-table">
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
                  {visibleCustomers?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell data-label={translate(locale, 'admin.reportCustomers')}>
                        <strong>{item.displayName}</strong>
                        <br />
                        <span className="admin-muted">{item.emailMasked}</span>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.identityProviders')}>
                        {item.providers.join(', ') || translate(locale, 'admin.notLinked')}
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.bookingCount')}>
                        {item.bookingCount}
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.status')}>
                        <AdminStatusBadge tone={item.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {translate(
                            locale,
                            item.status === 'ACTIVE'
                              ? 'admin.statusActive'
                              : 'admin.statusDisabled',
                          )}
                        </AdminStatusBadge>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.sessions')}>
                        {item.activeSessionCount}
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.lastActivity')}>
                        {item.lastActivityAt === null
                          ? translate(locale, 'admin.noActivity')
                          : formatDateTime(locale, item.lastActivityAt)}
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.action')}>
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
                              item.status === 'ACTIVE'
                                ? 'admin.lockAccount'
                                : 'admin.unlockAccount',
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
            </AdminDataTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
