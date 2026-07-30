'use client';

import { type FormEvent, useEffect, useState } from 'react';

import { AdminApiError, adminApi, type CatalogPage } from '../lib/admin-api';
import type { PriceTier } from '@room/contracts';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';

export function PriceTierManager() {
  const locale = useLocale();
  const [page, setPage] = useState<CatalogPage<PriceTier>>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void adminApi
      .listPriceTiers()
      .then(setPage)
      .catch((cause: unknown) =>
        setMessage(
          cause instanceof AdminApiError ? translate(locale, 'priceTier.loadError') : translate(locale, 'priceTier.loadError'),
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
    } catch (cause) {
      setMessage(cause instanceof AdminApiError ? translate(locale, 'priceTier.saveError') : translate(locale, 'priceTier.saveError'));
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
      setMessage(translate(locale, 'priceTier.archived', { name: tier.name }));
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError ? translate(locale, 'priceTier.archiveError') : translate(locale, 'priceTier.archiveError'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page">
      <h1>{translate(locale, 'admin.priceTiers')}</h1>
      <p>{translate(locale, 'priceTier.help')}</p>
      <form onSubmit={save}>
        <label>
          {translate(locale, 'priceTier.code')}
          <input
            disabled={pending}
            onChange={(event) => setCode(event.target.value)}
            required
            value={code}
          />
        </label>
        <label>
          {translate(locale, 'priceTier.name')}
          <input
            disabled={pending}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label>
          {translate(locale, 'priceTier.sortOrder')}
          <input
            disabled={pending}
            min="0"
            onChange={(event) => setSortOrder(event.target.value)}
            required
            type="number"
            value={sortOrder}
          />
        </label>
        <button disabled={pending} type="submit">
          {editingId === undefined ? translate(locale, 'priceTier.create') : translate(locale, 'priceTier.save')}
        </button>
      </form>
      {message === undefined ? null : <p role="alert">{message}</p>}
      {page === undefined ? <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p> : null}
      {page !== undefined && page.items.length === 0 ? (
        <div className="table-empty">{translate(locale, 'priceTier.empty')}</div>
      ) : null}
      {page === undefined || page.items.length === 0 ? null : (
        <table>
          <thead>
            <tr>
              <th scope="col">{translate(locale, 'admin.code')}</th>
              <th scope="col">{translate(locale, 'property.name')}</th>
              <th scope="col">{translate(locale, 'priceTier.sortOrder')}</th>
              <th scope="col">{translate(locale, 'admin.status')}</th>
              <th scope="col">{translate(locale, 'admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((tier) => (
              <tr key={tier.id}>
                <td>{tier.code}</td>
                <td>{tier.name}</td>
                <td>{tier.sortOrder}</td>
                <td>{tier.status}</td>
                <td>
                  <button
                    disabled={pending || tier.status === 'INACTIVE'}
                    onClick={() => {
                      setCode(tier.code);
                      setName(tier.name);
                      setSortOrder(String(tier.sortOrder));
                      setEditingId(tier.id);
                    }}
                    type="button"
                  >
                    {translate(locale, 'priceTier.edit', { name: tier.name })}
                  </button>{' '}
                  <button
                    aria-label={translate(locale, 'amenity.archive', { name: tier.name })}
                    disabled={pending || tier.status === 'INACTIVE'}
                    onClick={() => void archive(tier.id)}
                    type="button"
                  >
                    {translate(locale, 'catalog.archive')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
