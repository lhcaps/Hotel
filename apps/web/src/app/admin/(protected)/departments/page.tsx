'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '../../../../components/ui/button';
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
import { translate } from '../../../../lib/i18n/messages';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
} from '../../../../components/admin/admin-ui';

export default function AdminDepartmentsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminApi.listAdminDepartments>>>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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
    setPending(true);
    try {
      const created = await adminApi.createAdminDepartment({ code, name });
      setItems((current) => [...(current ?? []), created]);
      setCode('');
      setName('');
      setCreateOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow={translate(locale, 'admin.accessScope')}
        title={translate(locale, 'admin.departments')}
        description={translate(locale, 'admin.departmentRequirement')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            {translate(locale, 'admin.createDepartment')}
          </Button>
        }
      />
      {error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      <AdminFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={translate(locale, 'admin.createDepartment')}
        description={translate(locale, 'admin.departmentCodeHelp')}
      >
        <form className="admin-form-grid" onSubmit={(event) => void create(event)}>
          <label>
            {translate(locale, 'admin.departmentCode')}
            <Input required value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
          <label>
            {translate(locale, 'admin.departmentName')}
            <Input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <Button disabled={pending} type="submit">
            {pending
              ? translate(locale, 'admin.creating')
              : translate(locale, 'admin.createDepartment')}
          </Button>
        </form>
      </AdminFormSheet>
      {items === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loading')} />
      ) : items.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'admin.noDepartmentsFound')} />
      ) : (
        <AdminDataTable className="admin-departments-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate(locale, 'admin.departmentCode')}</TableHead>
                <TableHead>{translate(locale, 'admin.departmentName')}</TableHead>
                <TableHead>{translate(locale, 'admin.members')}</TableHead>
                <TableHead>{translate(locale, 'admin.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell data-label={translate(locale, 'admin.departmentCode')}>
                    <span className="admin-code">{item.code}</span>
                  </TableCell>
                  <TableCell data-label={translate(locale, 'admin.departmentName')}>
                    {item.name}
                  </TableCell>
                  <TableCell data-label={translate(locale, 'admin.members')}>
                    {item.memberCount}
                  </TableCell>
                  <TableCell data-label={translate(locale, 'admin.status')}>
                    <AdminStatusBadge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {translate(
                        locale,
                        item.status === 'ACTIVE' ? 'admin.statusActive' : 'admin.statusPaused',
                      )}
                    </AdminStatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDataTable>
      )}
    </div>
  );
}
