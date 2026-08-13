'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { AdminApiError, type CatalogPage } from '../lib/admin-api';
import { translate, translateAdminStatus } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table } from './ui/table';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
} from './admin/admin-ui';

interface CatalogRow {
  readonly id: string;
  readonly status: string;
}

interface CatalogColumn<T> {
  readonly heading: string;
  readonly cell: (item: T) => ReactNode;
}

interface CatalogTableProps<T extends CatalogRow> {
  readonly title: string;
  readonly description: string;
  readonly emptyMessage: string;
  readonly load: () => Promise<CatalogPage<T>>;
  readonly columns: readonly CatalogColumn<T>[];
  readonly archive?: (id: string) => Promise<T>;
  readonly archiveLabel?: (item: T) => string;
  readonly filter?: {
    readonly label: string;
    readonly placeholder: string;
    readonly matches: (item: T, query: string) => boolean;
  };
}

export function CatalogTable<T extends CatalogRow>({
  title,
  description,
  emptyMessage,
  load,
  columns,
  archive,
  archiveLabel,
  filter,
}: CatalogTableProps<T>) {
  const locale = useLocale();
  const [items, setItems] = useState<readonly T[]>();
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    void load()
      .then((page) => {
        if (active) setItems(page.items);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof AdminApiError
            ? translate(locale, 'catalog.loadError')
            : translate(locale, 'catalog.loadError'),
        );
      });
    return () => {
      active = false;
    };
  }, [load, locale]);

  async function archiveItem(item: T) {
    if (archive === undefined) return;
    setPendingId(item.id);
    setError(undefined);
    try {
      const archived = await archive(item.id);
      setItems((current) =>
        current === undefined
          ? current
          : current.map((candidate) => (candidate.id === archived.id ? archived : candidate)),
      );
    } catch (cause) {
      setError(
        cause instanceof AdminApiError
          ? translate(locale, 'catalog.saveError')
          : translate(locale, 'catalog.saveError'),
      );
    } finally {
      setPendingId(undefined);
    }
  }

  const visibleItems =
    items === undefined || filter === undefined || query.trim() === ''
      ? items
      : items.filter((item) => filter.matches(item, query.trim()));

  return (
    <section className="admin-page">
      <AdminPageHeader title={title} description={description} />
      {filter === undefined ? null : (
        <label>
          {filter.label}
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder={filter.placeholder}
            type="search"
            value={query}
          />
        </label>
      )}
      {visibleItems === undefined && error === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : null}
      {error === undefined ? null : (
        <AdminErrorState title={translate(locale, 'catalog.loadError')} description={error} />
      )}
      {visibleItems !== undefined && visibleItems.length === 0 ? (
        <AdminEmptyState
          title={
            items !== undefined && items.length > 0
              ? translate(locale, 'catalog.noResults')
              : emptyMessage
          }
        />
      ) : null}
      {visibleItems === undefined || visibleItems.length === 0 ? null : (
        <AdminDataTable variant="management">
          <Table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.heading} scope="col">
                    {column.heading}
                  </th>
                ))}
                <th scope="col">{translate(locale, 'admin.status')}</th>
                {archive === undefined ? null : (
                  <th scope="col">{translate(locale, 'admin.action')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  {columns.map((column) => (
                    <td key={column.heading}>{column.cell(item)}</td>
                  ))}
                  <td>
                    <AdminStatusBadge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {translateAdminStatus(locale, item.status)}
                    </AdminStatusBadge>
                  </td>
                  {archive === undefined ? null : (
                    <td>
                      <Button
                        aria-label={archiveLabel?.(item) ?? translate(locale, 'catalog.archive')}
                        disabled={pendingId !== undefined || item.status === 'INACTIVE'}
                        onClick={() => void archiveItem(item)}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        {translate(locale, 'catalog.archive')}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </AdminDataTable>
      )}
    </section>
  );
}
