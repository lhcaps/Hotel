'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

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
import { translate } from '../../../../lib/i18n/messages';

export default function AdminDepartmentsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminApi.listAdminDepartments>>>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

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
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="admin-page admin-page--narrow">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">{translate(locale, 'admin.accessScope')}</p>
          <h1>{translate(locale, 'admin.departments')}</h1>
          <p>{translate(locale, 'admin.departmentRequirement')}</p>
        </div>
      </div>
      {error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{translate(locale, 'admin.createDepartment')}</CardTitle>
          <CardDescription>{translate(locale, 'admin.departmentCodeHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{translate(locale, 'admin.departmentList')}</CardTitle>
        </CardHeader>
        <CardContent>
          {items === undefined ? (
            <p className="admin-state">{translate(locale, 'admin.loading')}</p>
          ) : items.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noDepartmentsFound')}</p>
          ) : (
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
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.memberCount}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'ACTIVE' ? 'secondary' : 'outline'}>
                        {translate(
                          locale,
                          item.status === 'ACTIVE' ? 'admin.statusActive' : 'admin.statusPaused',
                        )}
                      </Badge>
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
