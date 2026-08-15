'use client';

import { type FormEvent, useEffect, useState } from 'react';

import { AdminApiError, adminApi, type CatalogPage } from '../lib/admin-api';
import type { PriceTier } from '@room/contracts';
import { fromProblemDetails, pickFieldError } from '../lib/form-error';
import { translate, translateAdminStatus } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Alert, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field, FieldGroup, FieldLabel } from './ui/field';
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

export function PriceTierManager() {
  const locale = useLocale();
  const [page, setPage] = useState<CatalogPage<PriceTier>>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveCandidate, setArchiveCandidate] = useState<PriceTier>();

  useEffect(() => {
    void adminApi
      .listPriceTiers()
      .then(setPage)
      .catch((cause: unknown) =>
        setMessage(
          cause instanceof AdminApiError
            ? translate(locale, 'priceTier.loadError')
            : translate(locale, 'priceTier.loadError'),
        ),
      );
  }, [locale]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      const command = { code, name, sortOrder: Number(sortOrder) };
      const tier =
        editingId === undefined
          ? await adminApi.createPriceTier(command)
          : await adminApi.updatePriceTier(editingId, command);
      setPage((current) =>
        current === undefined
          ? current
          : {
              ...current,
              items:
                editingId === undefined
                  ? [...current.items, tier]
                  : current.items.map((item) => (item.id === tier.id ? tier : item)),
            },
      );
      setCode('');
      setName('');
      setSortOrder('0');
      setEditingId(undefined);
      setFormOpen(false);
    } catch (cause) {
      if (cause instanceof AdminApiError) {
        const problemState = fromProblemDetails(cause.problem);
        const fieldError =
          pickFieldError(problemState, 'code') ??
          pickFieldError(problemState, 'name') ??
          pickFieldError(problemState, 'sortOrder');
        if (fieldError !== undefined) {
          setMessage(fieldError);
          setPending(false);
          return;
        }
      }
      setMessage(translate(locale, 'priceTier.saveError'));
    } finally {
      setPending(false);
    }
  }

  async function archive(id: string) {
    setPending(true);
    setMessage(undefined);
    try {
      const tier = await adminApi.archivePriceTier(id);
      setPage((current) =>
        current === undefined
          ? current
          : { ...current, items: current.items.map((item) => (item.id === id ? tier : item)) },
      );
      setArchiveCandidate(undefined);
      setMessage(translate(locale, 'priceTier.archived', { name: tier.name }));
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError
          ? translate(locale, 'priceTier.archiveError')
          : translate(locale, 'priceTier.archiveError'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.priceTiers')}
        description={translate(locale, 'priceTier.help')}
        actions={
          <Button
            onClick={() => {
              setEditingId(undefined);
              setFormOpen(true);
            }}
          >
            {translate(locale, 'priceTier.create')}
          </Button>
        }
      />
      <AdminFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(undefined);
        }}
        title={
          editingId === undefined
            ? translate(locale, 'priceTier.create')
            : translate(locale, 'priceTier.save')
        }
        description={translate(locale, 'priceTier.help')}
      >
        <form className="admin-form-stack" onSubmit={save}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="price-tier-code">
                {translate(locale, 'priceTier.code')}
              </FieldLabel>
              <Input
                id="price-tier-code"
                disabled={pending}
                onChange={(event) => setCode(event.target.value)}
                required
                value={code}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="price-tier-name">
                {translate(locale, 'priceTier.name')}
              </FieldLabel>
              <Input
                id="price-tier-name"
                disabled={pending}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="price-tier-sort">
                {translate(locale, 'priceTier.sortOrder')}
              </FieldLabel>
              <Input
                id="price-tier-sort"
                disabled={pending}
                min="0"
                onChange={(event) => setSortOrder(event.target.value)}
                required
                type="number"
                value={sortOrder}
              />
            </Field>
            <Button disabled={pending} type="submit">
              {editingId === undefined
                ? translate(locale, 'priceTier.create')
                : translate(locale, 'priceTier.save')}
            </Button>
          </FieldGroup>
        </form>
      </AdminFormSheet>
      {message === undefined ? null : (
        <Alert>
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      )}
      {page === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : null}
      {page !== undefined && page.items.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'priceTier.empty')} />
      ) : null}
      {page === undefined || page.items.length === 0 ? null : (
        <AdminDataTable variant="management">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{translate(locale, 'admin.code')}</TableHead>
                <TableHead scope="col">{translate(locale, 'property.name')}</TableHead>
                <TableHead scope="col">{translate(locale, 'priceTier.sortOrder')}</TableHead>
                <TableHead scope="col">{translate(locale, 'admin.status')}</TableHead>
                <TableHead scope="col">{translate(locale, 'admin.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell>{tier.code}</TableCell>
                  <TableCell>{tier.name}</TableCell>
                  <TableCell>{tier.sortOrder}</TableCell>
                  <TableCell>
                    <AdminStatusBadge tone={tier.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {translateAdminStatus(locale, tier.status)}
                    </AdminStatusBadge>
                  </TableCell>
                  <TableCell>
                    <AdminRowActions
                      actions={[
                        {
                          label: translate(locale, 'priceTier.edit', { name: tier.name }),
                          disabled: pending || tier.status === 'INACTIVE',
                          onSelect: () => {
                            setCode(tier.code);
                            setName(tier.name);
                            setSortOrder(String(tier.sortOrder));
                            setEditingId(tier.id);
                            setFormOpen(true);
                          },
                        },
                        {
                          label: translate(locale, 'catalog.archive'),
                          destructive: true,
                          disabled: pending || tier.status === 'INACTIVE',
                          onSelect: () => setArchiveCandidate(tier),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
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
