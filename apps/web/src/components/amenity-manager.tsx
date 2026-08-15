'use client';

import type { Amenity } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminApiError, adminApi, type CatalogPage } from '../lib/admin-api';
import { fromProblemDetails, pickFieldError } from '../lib/form-error';
import { translate, translateAdminStatus } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  AdminDataTable,
  AdminDestructiveActionDialog,
  AdminEmptyState,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminRowActions,
  AdminStatusBadge,
} from './admin/admin-ui';

export function AmenityManager() {
  const locale = useLocale();
  const [page, setPage] = useState<CatalogPage<Amenity>>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string>();
  const [archiveCandidate, setArchiveCandidate] = useState<Amenity>();

  useEffect(() => {
    void adminApi
      .listAmenities()
      .then(setPage)
      .catch(() => setMessage(translate(locale, 'amenity.loadError')));
  }, [locale]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      const amenity = await adminApi.createAmenity({ code, name });
      setPage((current) =>
        current === undefined ? current : { ...current, items: [...current.items, amenity] },
      );
      setCode('');
      setName('');
      setCreateOpen(false);
    } catch (cause) {
      if (cause instanceof AdminApiError) {
        const problemState = fromProblemDetails(cause.problem);
        const fieldError =
          pickFieldError(problemState, 'code') ?? pickFieldError(problemState, 'name');
        if (fieldError !== undefined) {
          setMessage(fieldError);
          setPending(false);
          return;
        }
      }
      setMessage(translate(locale, 'amenity.createError'));
    } finally {
      setPending(false);
    }
  }

  async function archive(id: string) {
    setPending(true);
    setMessage(undefined);
    try {
      const amenity = await adminApi.archiveAmenity(id);
      setPage((current) =>
        current === undefined
          ? current
          : { ...current, items: current.items.map((item) => (item.id === id ? amenity : item)) },
      );
      setArchiveCandidate(undefined);
      setMessage(translate(locale, 'amenity.archived', { name: amenity.name }));
    } catch {
      setMessage(translate(locale, 'amenity.archiveError'));
    } finally {
      setPending(false);
    }
  }

  async function saveName(id: string): Promise<boolean> {
    const nextName = editing[id];
    if (nextName === undefined || nextName.trim() === '') return false;
    setPending(true);
    setMessage(undefined);
    setErrors((current) => ({ ...current, [id]: '' }));
    try {
      const updated = await adminApi.updateAmenity(id, { name: nextName.trim() });
      setPage((current) =>
        current === undefined
          ? current
          : { ...current, items: current.items.map((item) => (item.id === id ? updated : item)) },
      );
      setMessage(translate(locale, 'amenity.updated', { name: updated.name }));
      return true;
    } catch (cause) {
      if (cause instanceof AdminApiError) {
        const problemState = fromProblemDetails(cause.problem);
        const fieldError = pickFieldError(problemState, 'name');
        if (fieldError !== undefined) {
          setErrors((current) => ({ ...current, [id]: fieldError }));
          setPending(false);
          return false;
        }
      }
      const text =
        cause instanceof AdminApiError && cause.problem?.detail !== undefined
          ? cause.problem.detail
          : translate(locale, 'amenity.updateError');
      setErrors((current) => ({ ...current, [id]: text }));
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.amenities')}
        description={translate(locale, 'amenity.help')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>{translate(locale, 'amenity.create')}</Button>
        }
      />
      <AdminFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={translate(locale, 'amenity.create')}
        description={translate(locale, 'amenity.help')}
      >
        <form onSubmit={create}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="amenity-code">{translate(locale, 'amenity.code')}</FieldLabel>
              <Input
                disabled={pending}
                id="amenity-code"
                onChange={(event) => setCode(event.target.value)}
                required
                value={code}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="amenity-name">{translate(locale, 'amenity.name')}</FieldLabel>
              <Input
                disabled={pending}
                id="amenity-name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Button disabled={pending} type="submit">
              {translate(locale, 'amenity.create')}
            </Button>
          </FieldGroup>
        </form>
      </AdminFormSheet>
      {editId !== undefined
        ? (() => {
            const amenity = page?.items.find((item) => item.id === editId);
            if (amenity === undefined) return null;
            const draft = editing[amenity.id] ?? amenity.name;
            const error = errors[amenity.id];
            return (
              <AdminFormSheet
                open
                onOpenChange={(open) => {
                  if (!open) setEditId(undefined);
                }}
                title={translate(locale, 'amenity.saveName')}
                description={amenity.code}
                footer={
                  <Button
                    disabled={pending || draft.trim() === ''}
                    onClick={() =>
                      void saveName(amenity.id).then((saved) => {
                        if (saved) setEditId(undefined);
                      })
                    }
                  >
                    {translate(locale, 'amenity.saveName')}
                  </Button>
                }
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="amenity-edit-name">
                      {translate(locale, 'amenity.name')}
                    </FieldLabel>
                    <Input
                      id="amenity-edit-name"
                      onChange={(event) =>
                        setEditing((current) => ({ ...current, [amenity.id]: event.target.value }))
                      }
                      value={draft}
                    />
                  </Field>
                  {error !== undefined && error !== '' ? (
                    <Alert variant="destructive">
                      <AlertTitle>{translate(locale, 'amenity.updateError')}</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                </FieldGroup>
              </AdminFormSheet>
            );
          })()
        : null}
      {message === undefined ? null : (
        <Alert>
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      )}
      {page === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : null}
      {page !== undefined && page.items.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'catalog.noResults')} />
      ) : null}
      {page === undefined || page.items.length === 0 ? null : (
        <AdminDataTable variant="management">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{translate(locale, 'admin.code')}</TableHead>
                <TableHead scope="col">{translate(locale, 'amenity.name')}</TableHead>
                <TableHead scope="col">{translate(locale, 'admin.status')}</TableHead>
                <TableHead scope="col">{translate(locale, 'admin.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((amenity) => {
                return (
                  <TableRow key={amenity.id}>
                    <TableCell>{amenity.code}</TableCell>
                    <TableCell>{amenity.name}</TableCell>
                    <TableCell>
                      <AdminStatusBadge tone={amenity.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {translateAdminStatus(locale, amenity.status)}
                      </AdminStatusBadge>
                    </TableCell>
                    <TableCell>
                      <AdminRowActions
                        actions={[
                          {
                            label: translate(locale, 'amenity.saveName'),
                            onSelect: () => setEditId(amenity.id),
                          },
                          {
                            label: translate(locale, 'catalog.archive'),
                            destructive: true,
                            disabled: pending || amenity.status === 'INACTIVE',
                            onSelect: () => setArchiveCandidate(amenity),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </AdminDataTable>
      )}
      <AdminDestructiveActionDialog
        open={archiveCandidate !== undefined}
        onOpenChange={(open) => {
          if (!open) setArchiveCandidate(undefined);
        }}
        title={translate(locale, 'catalog.archive')}
        description={archiveCandidate?.name ?? ''}
        confirmLabel={translate(locale, 'catalog.archive')}
        pending={pending}
        onConfirm={() => {
          if (archiveCandidate !== undefined) void archive(archiveCandidate.id);
        }}
      />
    </section>
  );
}
