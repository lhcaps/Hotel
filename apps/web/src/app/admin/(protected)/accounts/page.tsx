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
import { Field, FieldError, FieldLabel } from '../../../../components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table';
import { useLocale } from '../../../../components/locale-provider';
import { AdminApiError, adminApi } from '../../../../lib/admin-api';
import { formatDateTime, translate, type MessageKey } from '../../../../lib/i18n/messages';
import {
  fromProblemDetails,
  fromUnknownError,
  type FieldErrorState,
} from '../../../../lib/form-error';
import {
  AdminDataTable,
  AdminFilterToolbar,
  AdminFormSheet,
  AdminTab,
  AdminTabContent,
  AdminTabList,
  AdminTabs,
  AdminMultiSelect,
  AdminPageHeader,
  AdminStatusBadge,
} from '../../../../components/admin/admin-ui';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { MoreHorizontalIcon } from 'lucide-react';

type AdminProfileCode =
  | 'SUPER_ADMIN'
  | 'ROOM_STATUS_VIEWER'
  | 'OPERATIONS_MANAGER'
  | 'HOUSEKEEPING_MANAGER'
  | 'HOUSEKEEPING_STAFF'
  | 'PAYMENT_STAFF'
  | 'MAINTENANCE_MANAGER'
  | 'MAINTENANCE_STAFF'
  | 'STAFF_MANAGER';
const profileOptions: readonly { readonly value: AdminProfileCode; readonly label: MessageKey }[] =
  [
    { value: 'SUPER_ADMIN', label: 'admin.roleSuperAdmin' },
    { value: 'ROOM_STATUS_VIEWER', label: 'admin.roleRoomStatusViewer' },
    { value: 'OPERATIONS_MANAGER', label: 'admin.roleOperationsManager' },
    { value: 'HOUSEKEEPING_MANAGER', label: 'admin.roleHousekeepingManager' },
    { value: 'HOUSEKEEPING_STAFF', label: 'admin.roleHousekeepingStaff' },
    { value: 'PAYMENT_STAFF', label: 'admin.rolePaymentStaff' },
    { value: 'MAINTENANCE_MANAGER', label: 'admin.roleMaintenanceManager' },
    { value: 'MAINTENANCE_STAFF', label: 'admin.roleMaintenanceStaff' },
    { value: 'STAFF_MANAGER', label: 'admin.roleStaffManager' },
  ];
type AccountDraft = {
  readonly role: AdminProfileCode;
  readonly departmentIds: readonly string[];
  readonly propertyIds: readonly string[];
};

type AccountView = 'staff' | 'customers';

type AccountActionKind = 'status' | 'sessions';

function AccountActionsMenu({
  disabled,
  emailMasked,
  hasActiveSessions,
  locale,
  onEdit,
  onRevokeSessions,
  onStatusChange,
  status,
  bookingsHref,
}: Readonly<{
  disabled: boolean;
  emailMasked: string;
  hasActiveSessions: boolean;
  locale: 'vi' | 'en';
  onEdit?: () => void;
  onRevokeSessions: () => void;
  onStatusChange: () => void;
  status: 'ACTIVE' | 'DISABLED';
  bookingsHref?: string;
}>) {
  const [pendingAction, setPendingAction] = useState<AccountActionKind>();
  const statusLabel = translate(
    locale,
    status === 'ACTIVE' ? 'admin.lockAccount' : 'admin.unlockAccount',
  );
  const confirmationLabel =
    pendingAction === 'status' ? statusLabel : translate(locale, 'admin.revokeSessions');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={translate(locale, 'admin.otherActions')}
              disabled={disabled}
              size="icon-sm"
              type="button"
              variant="outline"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit ? (
            <DropdownMenuItem onClick={onEdit}>
              {translate(locale, 'admin.profile')}
            </DropdownMenuItem>
          ) : null}
          {bookingsHref ? (
            <DropdownMenuItem render={<Link href={bookingsHref} />}>
              {translate(locale, 'admin.viewBookings')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setPendingAction('status')}>
            {statusLabel}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasActiveSessions}
            onClick={() => setPendingAction('sessions')}
          >
            {translate(locale, 'admin.revokeSessions')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingAction(undefined);
        }}
        open={pendingAction !== undefined}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationLabel}</AlertDialogTitle>
            <AlertDialogDescription>{emailMasked}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{translate(locale, 'admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingAction === 'status') onStatusChange();
                else onRevokeSessions();
                setPendingAction(undefined);
              }}
              variant={
                pendingAction === 'status' && status === 'ACTIVE' ? 'destructive' : 'default'
              }
            >
              {confirmationLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function readAccountView(): AccountView {
  if (typeof window === 'undefined') return 'staff';
  return new URLSearchParams(window.location.search).get('view') === 'customers'
    ? 'customers'
    : 'staff';
}

export default function AdminAccountsPage() {
  const locale = useLocale();
  const visibleDisplayName = (displayName: string) =>
    locale === 'vi' && displayName.trim().toLocaleLowerCase('en-US') === 'administrator'
      ? translate(locale, 'admin.actorAdministrator')
      : displayName;
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminApi.listAdminAccounts>>>();
  const [customers, setCustomers] =
    useState<Awaited<ReturnType<typeof adminApi.listCustomerAccounts>>>();
  const [departments, setDepartments] = useState<
    Awaited<ReturnType<typeof adminApi.listAdminDepartments>>
  >([]);
  const [accountProperties, setAccountProperties] = useState<
    Awaited<ReturnType<typeof adminApi.listAccountProperties>>
  >([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [me, setMe] = useState<Awaited<ReturnType<typeof adminApi.me>>>();
  const [drafts, setDrafts] = useState<Record<string, AccountDraft>>({});
  const [accountView, setAccountView] = useState<AccountView>('staff');
  const [createForm, setCreateForm] = useState<{
    displayName: string;
    email: string;
    password: string;
    role: AdminProfileCode;
    departmentIds: string[];
    propertyIds: string[];
  }>({
    displayName: '',
    email: '',
    password: '',
    role: 'ROOM_STATUS_VIEWER',
    departmentIds: [],
    propertyIds: [],
  });
  const [createErrors, setCreateErrors] = useState<FieldErrorState>({ fieldErrors: {} });
  const [createResult, setCreateResult] = useState<{
    displayName: string;
    roleLabel: string;
    propertyLabel: string | null;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string>();
  const [editErrors, setEditErrors] = useState<FieldErrorState>({ fieldErrors: {} });
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const [accounts, customerAccounts, current, availableDepartments] = await Promise.all([
        adminApi.listAdminAccounts(),
        adminApi.listCustomerAccounts(),
        adminApi.me(),
        adminApi.listAdminDepartments(),
      ]);
      const availableProperties =
        current.profileCode === 'SUPER_ADMIN' ? await adminApi.listAccountProperties() : [];
      setItems(accounts);
      setCustomers(customerAccounts);
      setMe(current);
      setDepartments(availableDepartments);
      setAccountProperties(availableProperties);
      setError(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    }
  }, [locale]);

  useEffect(() => {
    const syncView = () => setAccountView(readAccountView());
    syncView();
    window.addEventListener('popstate', syncView);
    return () => window.removeEventListener('popstate', syncView);
  }, []);

  const selectAccountView = useCallback((value: string) => {
    const next: AccountView = value === 'customers' ? 'customers' : 'staff';
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    window.history.pushState(null, '', `${url.pathname}${url.search}`);
    setAccountView(next);
    setQuery('');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetCreateForm() {
    setCreateForm({
      displayName: '',
      email: '',
      password: '',
      role: 'ROOM_STATUS_VIEWER',
      departmentIds: [],
      propertyIds: [],
    });
    setCreateErrors({ fieldErrors: {} });
  }

  function closeCreateSheet() {
    setCreateOpen(false);
    setCreateResult(null);
    resetCreateForm();
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createForm.role !== 'SUPER_ADMIN' && createForm.propertyIds.length === 0) {
      setCreateErrors({
        fieldErrors: { propertyIds: translate(locale, 'admin.errors.propertyScopeRequired') },
      });
      return;
    }
    setPending('create');
    setCreateErrors({ fieldErrors: {} });
    try {
      const created = await adminApi.createAdminAccount(
        createForm.role === 'SUPER_ADMIN' ? { ...createForm, propertyIds: undefined } : createForm,
      );
      const propertyLabel =
        created.propertyIds.length > 0
          ? accountProperties
              .filter((property) => created.propertyIds.includes(property.id))
              .map((property) => property.code)
              .join(', ')
          : null;
      const roleKey = profileOptions.find((option) => option.value === created.profileCode)?.label;
      setCreateResult({
        displayName: created.displayName,
        roleLabel: roleKey === undefined ? (created.profileCode ?? '') : translate(locale, roleKey),
        propertyLabel,
      });
      await load();
    } catch (cause) {
      if (cause instanceof AdminApiError) {
        setCreateErrors(fromProblemDetails(cause.problem));
      } else {
        setCreateErrors(fromUnknownError(cause, translate(locale, 'admin.errors.unexpected')));
      }
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
        propertyIds: item.propertyIds,
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
    setEditErrors({ fieldErrors: {} });
    if (draft.departmentIds.length === 0) {
      setEditErrors({
        fieldErrors: {
          departmentIds: translate(locale, 'admin.errors.departmentRequired'),
        },
      });
      return false;
    }
    if (draft.role !== 'SUPER_ADMIN' && draft.propertyIds.length === 0) {
      setEditErrors({
        fieldErrors: {
          propertyIds: translate(locale, 'admin.errors.propertyScopeRequired'),
        },
      });
      return false;
    }
    setPending(id);
    try {
      const updated = await adminApi.updateAdminAccount(
        id,
        draft.role === 'SUPER_ADMIN' ? { ...draft, propertyIds: undefined } : draft,
      );
      setItems((current) =>
        current?.map((candidate) => (candidate.id === id ? updated : candidate)),
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setEditAccountId(undefined);
    } catch (cause) {
      if (cause instanceof AdminApiError) {
        setEditErrors(fromProblemDetails(cause.problem));
      } else {
        setEditErrors(fromUnknownError(cause, translate(locale, 'admin.errors.unexpected')));
      }
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
      <AdminTabs value={accountView} onValueChange={selectAccountView}>
        <AdminTabList variant="line" aria-label={translate(locale, 'admin.accountType')}>
          <AdminTab value="staff">{translate(locale, 'admin.adminAccounts')}</AdminTab>
          <AdminTab value="customers">{translate(locale, 'admin.customerAccounts')}</AdminTab>
        </AdminTabList>
        {error ? (
          <p className="admin-alert admin-alert--error" role="alert">
            {error}
          </p>
        ) : null}
        <AdminFilterToolbar>
          <Field>
            <FieldLabel htmlFor="admin-account-search">
              {translate(locale, 'admin.search')}
            </FieldLabel>
            <Input
              id="admin-account-search"
              type="search"
              placeholder={translate(locale, 'admin.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <div className="admin-filter-toolbar__summary">
            {accountView === 'staff'
              ? translate(locale, 'admin.adminProfilesCount', {
                  count: visibleItems?.length ?? 0,
                })
              : null}
            {accountView === 'staff'
              ? null
              : `${translate(locale, 'admin.customerAccounts')}: ${visibleCustomers?.length ?? 0}`}
          </div>
        </AdminFilterToolbar>

        {me?.profileCode === 'SUPER_ADMIN' ? (
          <AdminFormSheet
            open={createOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeCreateSheet();
                return;
              }
              setCreateOpen(true);
            }}
            title={translate(locale, 'admin.createAccount')}
            description={translate(locale, 'admin.createAccountHelp')}
          >
            {createResult !== null ? (
              <div className="admin-form-stack" data-testid="admin-create-success">
                <Alert>
                  <AlertTitle>{translate(locale, 'admin.createSuccess')}</AlertTitle>
                  <AlertDescription>
                    <strong>{createResult.displayName}</strong>
                    <br />
                    {createResult.roleLabel}
                    {createResult.propertyLabel !== null ? ` · ${createResult.propertyLabel}` : ''}
                  </AlertDescription>
                </Alert>
                <div className="admin-form-stack__actions">
                  <Button
                    onClick={() => {
                      resetCreateForm();
                      setCreateResult(null);
                    }}
                    type="button"
                    variant="outline"
                  >
                    {translate(locale, 'admin.createAnother')}
                  </Button>
                  <Button onClick={() => closeCreateSheet()} type="button">
                    {translate(locale, 'admin.closeSheet')}
                  </Button>
                </div>
              </div>
            ) : (
              <form
                autoComplete="off"
                className="admin-form-stack"
                noValidate
                onSubmit={(event) => void createAccount(event)}
              >
                {createErrors.formError !== undefined ? (
                  <Alert variant="destructive" data-testid="admin-create-error">
                    <AlertTitle>{createErrors.formError}</AlertTitle>
                    {createErrors.requestId !== undefined ? (
                      <AlertDescription>
                        {translate(locale, 'admin.errors.requestIdSuffix', {
                          id: createErrors.requestId,
                        })}
                      </AlertDescription>
                    ) : null}
                  </Alert>
                ) : null}
                <Field
                  data-invalid={createErrors.fieldErrors.displayName !== undefined}
                  data-testid="admin-create-field-displayName"
                >
                  <FieldLabel htmlFor="new-admin-display-name">
                    {translate(locale, 'admin.displayName')}
                  </FieldLabel>
                  <Input
                    aria-describedby={
                      createErrors.fieldErrors.displayName !== undefined
                        ? 'new-admin-display-name-error'
                        : undefined
                    }
                    aria-invalid={createErrors.fieldErrors.displayName !== undefined}
                    autoComplete="off"
                    disabled={pending !== undefined}
                    id="new-admin-display-name"
                    maxLength={160}
                    name="new-admin-display-name"
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, displayName: event.target.value }))
                    }
                    required
                    value={createForm.displayName}
                  />
                  {createErrors.fieldErrors.displayName !== undefined ? (
                    <FieldError id="new-admin-display-name-error">
                      {createErrors.fieldErrors.displayName}
                    </FieldError>
                  ) : null}
                </Field>
                <Field
                  data-invalid={createErrors.fieldErrors.email !== undefined}
                  data-testid="admin-create-field-email"
                >
                  <FieldLabel htmlFor="new-admin-email">Email</FieldLabel>
                  <Input
                    aria-describedby={
                      createErrors.fieldErrors.email !== undefined
                        ? 'new-admin-email-error'
                        : undefined
                    }
                    aria-invalid={createErrors.fieldErrors.email !== undefined}
                    autoComplete="off"
                    disabled={pending !== undefined}
                    id="new-admin-email"
                    name="new-admin-email"
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, email: event.target.value }))
                    }
                    required
                    type="email"
                    value={createForm.email}
                  />
                  {createErrors.fieldErrors.email !== undefined ? (
                    <FieldError id="new-admin-email-error">
                      {createErrors.fieldErrors.email}
                    </FieldError>
                  ) : null}
                </Field>
                <Field
                  data-invalid={
                    createErrors.fieldErrors.password !== undefined ||
                    createErrors.fieldErrors.password === undefined
                      ? createErrors.fieldErrors.password !== undefined
                      : false
                  }
                  data-testid="admin-create-field-password"
                >
                  <FieldLabel htmlFor="new-admin-password">
                    {translate(locale, 'admin.password')}
                  </FieldLabel>
                  <Input
                    aria-describedby={
                      createErrors.fieldErrors.password !== undefined
                        ? 'new-admin-password-error'
                        : 'new-admin-password-help'
                    }
                    aria-invalid={createErrors.fieldErrors.password !== undefined}
                    autoComplete="new-password"
                    disabled={pending !== undefined}
                    id="new-admin-password"
                    maxLength={128}
                    minLength={8}
                    name="new-admin-password"
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, password: event.target.value }))
                    }
                    required
                    type="password"
                    value={createForm.password}
                  />
                  {createErrors.fieldErrors.password !== undefined ? (
                    <FieldError id="new-admin-password-error">
                      {createErrors.fieldErrors.password}
                    </FieldError>
                  ) : (
                    <small className="admin-field-hint" id="new-admin-password-help">
                      {translate(locale, 'admin.passwordHelp')}
                    </small>
                  )}
                </Field>
                <Field
                  data-invalid={createErrors.fieldErrors.role !== undefined}
                  data-testid="admin-create-field-role"
                >
                  <FieldLabel htmlFor="new-admin-role">
                    {translate(locale, 'admin.profile')}
                  </FieldLabel>
                  <Select
                    value={createForm.role}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setCreateForm((current) => ({ ...current, role: value as AdminProfileCode }));
                    }}
                  >
                    <SelectTrigger className="w-full" id="new-admin-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {profileOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {translate(locale, option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  data-invalid={createErrors.fieldErrors.departmentIds !== undefined}
                  data-testid="admin-create-field-departments"
                >
                  <FieldLabel>{translate(locale, 'admin.department')}</FieldLabel>
                  <AdminMultiSelect
                    ariaLabel={translate(locale, 'admin.department')}
                    options={departments.map((department) => ({
                      value: department.id,
                      label: department.name,
                    }))}
                    value={createForm.departmentIds}
                    onChange={(departmentIds) =>
                      setCreateForm((current) => ({
                        ...current,
                        departmentIds: [...departmentIds],
                      }))
                    }
                    placeholder={translate(locale, 'admin.department')}
                  />
                  {createErrors.fieldErrors.departmentIds !== undefined ? (
                    <FieldError>{createErrors.fieldErrors.departmentIds}</FieldError>
                  ) : null}
                </Field>
                {createForm.role !== 'SUPER_ADMIN' ? (
                  <Field
                    data-invalid={createErrors.fieldErrors.propertyIds !== undefined}
                    data-testid="admin-create-field-properties"
                  >
                    <FieldLabel>{translate(locale, 'admin.property')}</FieldLabel>
                    <AdminMultiSelect
                      ariaLabel={translate(locale, 'admin.property')}
                      options={accountProperties.map((property) => ({
                        value: property.id,
                        label: `${property.code} · ${property.name}`,
                      }))}
                      value={createForm.propertyIds}
                      onChange={(propertyIds) =>
                        setCreateForm((current) => ({ ...current, propertyIds: [...propertyIds] }))
                      }
                      placeholder={translate(locale, 'admin.property')}
                    />
                    {createErrors.fieldErrors.propertyIds !== undefined ? (
                      <FieldError>{createErrors.fieldErrors.propertyIds}</FieldError>
                    ) : null}
                  </Field>
                ) : null}
                <Button disabled={pending !== undefined} type="submit">
                  {pending === 'create'
                    ? translate(locale, 'admin.creating')
                    : translate(locale, 'admin.create')}
                </Button>
              </form>
            )}
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
                    if (!open) {
                      setEditAccountId(undefined);
                      setEditErrors({ fieldErrors: {} });
                    }
                  }}
                  title={translate(locale, 'admin.profile')}
                  description={item.emailMasked}
                  footer={
                    <Button
                      disabled={pending !== undefined}
                      onClick={() => void saveAssignment(item.id)}
                    >
                      {pending === item.id
                        ? translate(locale, 'admin.saving')
                        : translate(locale, 'admin.saveProfile')}
                    </Button>
                  }
                >
                  <div className="admin-form-stack">
                    {editErrors.formError !== undefined ? (
                      <Alert variant="destructive" data-testid="admin-edit-error">
                        <AlertTitle>{editErrors.formError}</AlertTitle>
                        {editErrors.requestId !== undefined ? (
                          <AlertDescription>
                            {translate(locale, 'admin.errors.requestIdSuffix', {
                              id: editErrors.requestId,
                            })}
                          </AlertDescription>
                        ) : null}
                      </Alert>
                    ) : null}
                    <Field
                      data-invalid={editErrors.fieldErrors.role !== undefined}
                      data-testid="admin-edit-field-role"
                    >
                      <FieldLabel htmlFor={`edit-role-${item.id}`}>
                        {translate(locale, 'admin.profile')}
                      </FieldLabel>
                      <Select
                        value={draft.role}
                        onValueChange={(value) => {
                          if (value !== null)
                            updateDraft(item.id, { role: value as AdminProfileCode });
                        }}
                      >
                        <SelectTrigger className="w-full" id={`edit-role-${item.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {profileOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {translate(locale, option.label)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {editErrors.fieldErrors.role !== undefined ? (
                        <FieldError>{editErrors.fieldErrors.role}</FieldError>
                      ) : null}
                    </Field>
                    <Field
                      data-invalid={editErrors.fieldErrors.departmentIds !== undefined}
                      data-testid="admin-edit-field-departments"
                    >
                      <FieldLabel>{translate(locale, 'admin.department')}</FieldLabel>
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
                      {editErrors.fieldErrors.departmentIds !== undefined ? (
                        <FieldError>{editErrors.fieldErrors.departmentIds}</FieldError>
                      ) : null}
                    </Field>
                    {draft.role !== 'SUPER_ADMIN' ? (
                      <Field
                        data-invalid={editErrors.fieldErrors.propertyIds !== undefined}
                        data-testid="admin-edit-field-properties"
                      >
                        <FieldLabel>{translate(locale, 'admin.property')}</FieldLabel>
                        <AdminMultiSelect
                          ariaLabel={translate(locale, 'admin.property')}
                          options={accountProperties.map((property) => ({
                            value: property.id,
                            label: `${property.code} · ${property.name}`,
                          }))}
                          value={draft.propertyIds}
                          onChange={(propertyIds) => updateDraft(item.id, { propertyIds })}
                          placeholder={translate(locale, 'admin.property')}
                        />
                        {editErrors.fieldErrors.propertyIds !== undefined ? (
                          <FieldError>{editErrors.fieldErrors.propertyIds}</FieldError>
                        ) : null}
                      </Field>
                    ) : null}
                  </div>
                </AdminFormSheet>
              );
            })()
          : null}

        <AdminTabContent value="staff">
          <Card>
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
                <AdminDataTable variant="management" className="admin-accounts-table">
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
                              <strong>{visibleDisplayName(item.displayName)}</strong>
                              <br />
                              <span className="admin-muted">{item.emailMasked}</span>
                            </TableCell>
                            <TableCell data-label={translate(locale, 'admin.profile')}>
                              <span>
                                {translate(
                                  locale,
                                  profileOptions.find((option) => option.value === draft.role)
                                    ?.label ?? 'admin.roleRoomStatusViewer',
                                )}
                              </span>
                              {item.profileCode === null ? (
                                <Badge variant="destructive">
                                  {translate(locale, 'admin.needsAssignment')}
                                </Badge>
                              ) : null}
                            </TableCell>
                            <TableCell data-label={translate(locale, 'admin.department')}>
                              {item.departments.join(', ') ||
                                translate(locale, 'account.notAvailable')}
                            </TableCell>
                            <TableCell data-label={translate(locale, 'admin.status')}>
                              <AdminStatusBadge
                                tone={item.status === 'ACTIVE' ? 'success' : 'danger'}
                              >
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
                              <AccountActionsMenu
                                disabled={pending !== undefined}
                                emailMasked={item.emailMasked}
                                hasActiveSessions={item.activeSessionCount > 0}
                                locale={locale}
                                onEdit={() => setEditAccountId(item.id)}
                                onRevokeSessions={() => void revokeSessions(item.id)}
                                onStatusChange={() =>
                                  void changeStatus(
                                    item.id,
                                    item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                                  )
                                }
                                status={item.status}
                              />
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
        </AdminTabContent>

        <AdminTabContent value="customers">
          <Card>
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
                <AdminDataTable variant="management" className="admin-customer-accounts-table">
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
                            <strong>{visibleDisplayName(item.displayName)}</strong>
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
                            <AdminStatusBadge
                              tone={item.status === 'ACTIVE' ? 'success' : 'danger'}
                            >
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
                            <AccountActionsMenu
                              bookingsHref={`/admin/bookings?customerUserId=${encodeURIComponent(item.id)}`}
                              disabled={pending !== undefined}
                              emailMasked={item.emailMasked}
                              hasActiveSessions={item.activeSessionCount > 0}
                              locale={locale}
                              onRevokeSessions={() => void revokeSessions(item.id, true)}
                              onStatusChange={() =>
                                void changeStatus(
                                  item.id,
                                  item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                                  true,
                                )
                              }
                              status={item.status}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AdminDataTable>
              )}
            </CardContent>
          </Card>
        </AdminTabContent>
      </AdminTabs>
    </div>
  );
}
