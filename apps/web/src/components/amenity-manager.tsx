'use client';

import type { Amenity } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminApiError, adminApi, type CatalogPage } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';

export function AmenityManager() {
  const locale = useLocale();
  const [page, setPage] = useState<CatalogPage<Amenity>>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    } catch {
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
      setMessage(translate(locale, 'amenity.archived', { name: amenity.name }));
    } catch {
      setMessage(translate(locale, 'amenity.archiveError'));
    } finally {
      setPending(false);
    }
  }

  async function saveName(id: string) {
    const nextName = editing[id];
    if (nextName === undefined || nextName.trim() === '') return;
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
    } catch (cause) {
      const text =
        cause instanceof AdminApiError && cause.problem?.detail !== undefined
          ? cause.problem.detail
          : translate(locale, 'amenity.updateError');
      setErrors((current) => ({ ...current, [id]: text }));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page">
      <h1>{translate(locale, 'admin.amenities')}</h1>
      <p>{translate(locale, 'amenity.help')}</p>
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
      {message === undefined ? null : <p role="alert">{message}</p>}
      {page === undefined ? (
        <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p>
      ) : null}
      {page === undefined || page.items.length === 0 ? null : (
        <table>
          <thead>
            <tr>
              <th scope="col">{translate(locale, 'admin.code')}</th>
              <th scope="col">{translate(locale, 'amenity.name')}</th>
              <th scope="col">{translate(locale, 'admin.status')}</th>
              <th scope="col">{translate(locale, 'admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((amenity) => {
              const draft = editing[amenity.id] ?? amenity.name;
              const error = errors[amenity.id];
              return (
                <tr key={amenity.id}>
                  <td>{amenity.code}</td>
                  <td>
                    <span>{amenity.name}</span>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={`amenity-edit-${amenity.id}`}>
                          {translate(locale, 'amenity.name')}
                        </FieldLabel>
                        <Input
                          id={`amenity-edit-${amenity.id}`}
                          onChange={(event) =>
                            setEditing((current) => ({
                              ...current,
                              [amenity.id]: event.target.value,
                            }))
                          }
                          value={draft}
                        />
                      </Field>
                      <Button
                        disabled={pending || draft.trim() === '' || draft === amenity.name}
                        onClick={() => void saveName(amenity.id)}
                        size="sm"
                        type="button"
                      >
                        {translate(locale, 'amenity.saveName')}
                      </Button>
                      {error !== undefined && error !== '' ? (
                        <Alert variant="destructive">
                          <AlertTitle>{translate(locale, 'amenity.updateError')}</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ) : null}
                    </FieldGroup>
                  </td>
                  <td>{amenity.status}</td>
                  <td>
                    <Button
                      aria-label={translate(locale, 'amenity.archive', { name: amenity.name })}
                      disabled={pending || amenity.status === 'INACTIVE'}
                      onClick={() => void archive(amenity.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {translate(locale, 'catalog.archive')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
