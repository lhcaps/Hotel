'use client';
import type { Amenity, PriceTier, RoomType } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { AdminApiError, adminApi, type CatalogPage } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import {
  Field,
  FieldGroup,
  FieldLabel,
} from './ui/field';
import { Input } from './ui/input';

interface RoomTypeEditDraft {
  readonly name: string;
  readonly description: string;
  readonly maxAdults: number;
  readonly maxChildren: number;
  readonly maxOccupancy: number;
  readonly priceTierId: string;
}

const emptyDraft: RoomTypeEditDraft = {
  name: '',
  description: '',
  maxAdults: 2,
  maxChildren: 0,
  maxOccupancy: 2,
  priceTierId: '',
};

function draftFromRoomType(roomType: RoomType, fallbackTierId: string): RoomTypeEditDraft {
  return {
    name: roomType.name,
    description: roomType.description ?? '',
    maxAdults: roomType.maxAdults,
    maxChildren: roomType.maxChildren,
    maxOccupancy: roomType.maxOccupancy,
    priceTierId: roomType.priceTierId ?? fallbackTierId,
  };
}

function isCapacityValid(draft: RoomTypeEditDraft) {
  return (
    draft.maxOccupancy >= draft.maxAdults &&
    draft.maxOccupancy >= draft.maxChildren &&
    draft.maxOccupancy <= draft.maxAdults + draft.maxChildren
  );
}

export function RoomTypeManager() {
  const locale = useLocale();
  const [types, setTypes] = useState<CatalogPage<RoomType>>();
  const [tiers, setTiers] = useState<readonly PriceTier[]>([]);
  const [amenities, setAmenities] = useState<readonly Amenity[]>([]);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [priceTierId, setPriceTierId] = useState('');
  const [amenityId, setAmenityId] = useState('');
  const [amenityRoomTypeId, setAmenityRoomTypeId] = useState('');
  const [createMaxAdults, setCreateMaxAdults] = useState(2);
  const [createMaxChildren, setCreateMaxChildren] = useState(0);
  const [createMaxOccupancy, setCreateMaxOccupancy] = useState(2);
  const [drafts, setDrafts] = useState<Record<string, RoomTypeEditDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void Promise.all([
      adminApi.listRoomTypes(),
      adminApi.listPriceTiers(),
      adminApi.listAmenities(),
    ])
      .then(([roomTypes, priceTiers, amenityPage]) => {
        setTypes(roomTypes);
        setTiers(priceTiers.items);
        setAmenities(amenityPage.items.filter((amenity) => amenity.status === 'ACTIVE'));
        const firstTier = priceTiers.items[0]?.id ?? '';
        setPriceTierId(firstTier);
        setAmenityRoomTypeId(roomTypes.items[0]?.id ?? '');
        setAmenityId(amenityPage.items.find((amenity) => amenity.status === 'ACTIVE')?.id ?? '');
        setDrafts(
          Object.fromEntries(
            roomTypes.items.map((roomType) => [
              roomType.id,
              draftFromRoomType(roomType, firstTier),
            ]),
          ),
        );
      })
      .catch((cause: unknown) =>
        setMessage(
          cause instanceof AdminApiError
            ? translate(locale, 'roomType.loadError')
            : translate(locale, 'roomType.loadError'),
        ),
      );
  }, [locale]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      const roomType = await adminApi.createRoomType({
        priceTierId,
        code,
        name,
        maxAdults: createMaxAdults,
        maxChildren: createMaxChildren,
        maxOccupancy: createMaxOccupancy,
      });
      setTypes((current) =>
        current === undefined ? current : { ...current, items: [...current.items, roomType] },
      );
      setAmenityRoomTypeId(roomType.id);
      setDrafts((current) => ({
        ...current,
        [roomType.id]: draftFromRoomType(roomType, priceTierId),
      }));
      setCode('');
      setName('');
    } catch {
      setMessage(translate(locale, 'roomType.createError'));
    } finally {
      setPending(false);
    }
  }

  async function archive(id: string) {
    setPending(true);
    setMessage(undefined);
    try {
      const roomType = await adminApi.archiveRoomType(id);
      setTypes((current) =>
        current === undefined
          ? current
          : { ...current, items: current.items.map((item) => (item.id === id ? roomType : item)) },
      );
      setMessage(translate(locale, 'roomType.archived', { name: roomType.name }));
    } catch {
      setMessage(translate(locale, 'roomType.archiveError'));
    } finally {
      setPending(false);
    }
  }

  async function assignAmenity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    try {
      await adminApi.assignAmenity(amenityRoomTypeId, amenityId);
      setMessage(translate(locale, 'roomType.amenityAssigned'));
    } catch {
      setMessage(translate(locale, 'roomType.assignError'));
    } finally {
      setPending(false);
    }
  }

  async function removeAmenity(roomTypeId: string, amenityIdToRemove: string) {
    setPending(true);
    setMessage(undefined);
    try {
      await adminApi.removeAmenityFromRoomType(roomTypeId, amenityIdToRemove);
      setMessage(translate(locale, 'roomType.amenityRemoved'));
    } catch {
      setMessage(translate(locale, 'roomType.removeAmenityError'));
    } finally {
      setPending(false);
    }
  }

  function updateDraft(id: string, patch: Partial<RoomTypeEditDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyDraft), ...patch },
    }));
  }

  async function saveDraft(id: string) {
    const draft = drafts[id];
    if (draft === undefined) return;
    if (!isCapacityValid(draft)) {
      setErrors((current) => ({ ...current, [id]: translate(locale, 'roomType.invalidCapacity') }));
      return;
    }
    setPending(true);
    setMessage(undefined);
    setErrors((current) => ({ ...current, [id]: '' }));
    try {
      const updated = await adminApi.updateRoomType(id, {
        name: draft.name,
        description: draft.description === '' ? null : draft.description,
        maxAdults: draft.maxAdults,
        maxChildren: draft.maxChildren,
        maxOccupancy: draft.maxOccupancy,
        priceTierId: draft.priceTierId,
      });
      setTypes((current) =>
        current === undefined
          ? current
          : { ...current, items: current.items.map((item) => (item.id === id ? updated : item)) },
      );
      setMessage(translate(locale, 'roomType.updated', { name: updated.name }));
    } catch (cause) {
      const text =
        cause instanceof AdminApiError && cause.problem?.detail !== undefined
          ? cause.problem.detail
          : translate(locale, 'roomType.updateError');
      setErrors((current) => ({ ...current, [id]: text }));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page">
      <h1>{translate(locale, 'admin.roomTypes')}</h1>
      <p>{translate(locale, 'roomType.help')}</p>
      <form onSubmit={create}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="room-type-price-tier">{translate(locale, 'roomType.priceTier')}</FieldLabel>
            <select
              disabled={pending || tiers.length === 0}
              id="room-type-price-tier"
              onChange={(event) => setPriceTierId(event.target.value)}
              value={priceTierId}
            >
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="room-type-code">{translate(locale, 'roomType.code')}</FieldLabel>
            <Input
              disabled={pending}
              id="room-type-code"
              onChange={(event) => setCode(event.target.value)}
              required
              value={code}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="room-type-name">{translate(locale, 'roomType.name')}</FieldLabel>
            <Input
              disabled={pending}
              id="room-type-name"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="room-type-max-adults">{translate(locale, 'roomType.maxAdults')}</FieldLabel>
            <Input
              disabled={pending}
              id="room-type-max-adults"
              min={1}
              onChange={(event) => setCreateMaxAdults(Number(event.target.value))}
              required
              type="number"
              value={createMaxAdults}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="room-type-max-children">{translate(locale, 'roomType.maxChildren')}</FieldLabel>
            <Input
              disabled={pending}
              id="room-type-max-children"
              min={0}
              onChange={(event) => setCreateMaxChildren(Number(event.target.value))}
              required
              type="number"
              value={createMaxChildren}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="room-type-max-occupancy">{translate(locale, 'roomType.maxOccupancy')}</FieldLabel>
            <Input
              disabled={pending}
              id="room-type-max-occupancy"
              min={1}
              onChange={(event) => setCreateMaxOccupancy(Number(event.target.value))}
              required
              type="number"
              value={createMaxOccupancy}
            />
          </Field>
          <Button disabled={pending || priceTierId === ''} type="submit">
            {translate(locale, 'roomType.create')}
          </Button>
        </FieldGroup>
      </form>
      {message === undefined ? null : <p role="alert">{message}</p>}
      {types === undefined ? <p aria-live="polite">{translate(locale, 'admin.loadingData')}</p> : null}
      {types === undefined || types.items.length === 0 ? null : (
        <table>
          <thead>
            <tr>
              <th scope="col">{translate(locale, 'admin.code')}</th>
              <th scope="col">{translate(locale, 'roomType.name')}</th>
              <th scope="col">{translate(locale, 'roomType.capacity')}</th>
              <th scope="col">{translate(locale, 'admin.status')}</th>
              <th scope="col">{translate(locale, 'admin.action')}</th>
            </tr>
          </thead>
          <tbody>
            {types.items.map((roomType) => {
              const draft = drafts[roomType.id] ?? draftFromRoomType(roomType, priceTierId);
              const error = errors[roomType.id];
              return (
                <tr key={roomType.id} data-testid={`room-type-row-${roomType.code}`}>
                  <td>{roomType.code}</td>
                  <td>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={`edit-name-${roomType.id}`}>
                          {translate(locale, 'roomType.name')}
                        </FieldLabel>
                        <Input
                          id={`edit-name-${roomType.id}`}
                          onChange={(event) => updateDraft(roomType.id, { name: event.target.value })}
                          required
                          value={draft.name}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`edit-description-${roomType.id}`}>
                          {translate(locale, 'roomType.description')}
                        </FieldLabel>
                        <Input
                          id={`edit-description-${roomType.id}`}
                          onChange={(event) =>
                            updateDraft(roomType.id, { description: event.target.value })
                          }
                          value={draft.description}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`edit-tier-${roomType.id}`}>
                          {translate(locale, 'roomType.priceTier')}
                        </FieldLabel>
                        <select
                          id={`edit-tier-${roomType.id}`}
                          onChange={(event) =>
                            updateDraft(roomType.id, { priceTierId: event.target.value })
                          }
                          value={draft.priceTierId}
                        >
                          {tiers.map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`edit-adults-${roomType.id}`}>
                          {translate(locale, 'roomType.maxAdults')}
                        </FieldLabel>
                        <Input
                          id={`edit-adults-${roomType.id}`}
                          min={1}
                          onChange={(event) =>
                            updateDraft(roomType.id, { maxAdults: Number(event.target.value) })
                          }
                          type="number"
                          value={draft.maxAdults}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`edit-children-${roomType.id}`}>
                          {translate(locale, 'roomType.maxChildren')}
                        </FieldLabel>
                        <Input
                          id={`edit-children-${roomType.id}`}
                          min={0}
                          onChange={(event) =>
                            updateDraft(roomType.id, { maxChildren: Number(event.target.value) })
                          }
                          type="number"
                          value={draft.maxChildren}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`edit-occupancy-${roomType.id}`}>
                          {translate(locale, 'roomType.maxOccupancy')}
                        </FieldLabel>
                        <Input
                          id={`edit-occupancy-${roomType.id}`}
                          min={1}
                          onChange={(event) =>
                            updateDraft(roomType.id, { maxOccupancy: Number(event.target.value) })
                          }
                          type="number"
                          value={draft.maxOccupancy}
                        />
                      </Field>
                      <Button
                        disabled={pending || !isCapacityValid(draft)}
                        onClick={() => void saveDraft(roomType.id)}
                        type="button"
                      >
                        {translate(locale, 'roomType.saveChanges')}
                      </Button>
                      {error !== undefined && error !== '' ? (
                        <Alert variant="destructive">
                          <AlertTitle>{translate(locale, 'roomType.updateError')}</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ) : null}
                    </FieldGroup>
                  </td>
                  <td>
                    {draft.maxAdults}/{draft.maxChildren}/{draft.maxOccupancy}
                  </td>
                  <td>{roomType.status}</td>
                  <td>
                    <Button
                      aria-label={translate(locale, 'amenity.archive', { name: roomType.name })}
                      disabled={pending || roomType.status === 'INACTIVE'}
                      onClick={() => void archive(roomType.id)}
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
      <form onSubmit={assignAmenity}>
        <h2>{translate(locale, 'roomType.assignAmenity')}</h2>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="room-type-assign-target">{translate(locale, 'roomType.assignTarget')}</FieldLabel>
            <select
              disabled={pending || types?.items.length === 0}
              id="room-type-assign-target"
              onChange={(event) => setAmenityRoomTypeId(event.target.value)}
              value={amenityRoomTypeId}
            >
              {(types?.items ?? [])
                .filter((type) => type.status === 'ACTIVE')
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="room-type-assign-amenity">{translate(locale, 'admin.amenities')}</FieldLabel>
            <select
              disabled={pending || amenities.length === 0}
              id="room-type-assign-amenity"
              onChange={(event) => setAmenityId(event.target.value)}
              value={amenityId}
            >
              {amenities.map((amenity) => (
                <option key={amenity.id} value={amenity.id}>
                  {amenity.name}
                </option>
              ))}
            </select>
          </Field>
          <Button
            disabled={pending || amenityRoomTypeId === '' || amenityId === ''}
            type="submit"
          >
            {translate(locale, 'roomType.assignAmenity')}
          </Button>
        </FieldGroup>
      </form>
      {types === undefined ? null : (
        <section>
          <h2>{translate(locale, 'roomType.removeAmenity')}</h2>
          <ul>
            {types.items
              .filter((type) => type.status === 'ACTIVE')
              .map((type) => (
                <li key={type.id}>
                  <strong>{type.name}</strong>
                  <ul>
                    {amenities.map((amenity) => (
                      <li key={amenity.id}>
                        {amenity.name}
                        <Button
                          aria-label={translate(locale, 'roomType.removeAmenity')}
                          disabled={pending}
                          onClick={() => void removeAmenity(type.id, amenity.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {translate(locale, 'roomType.removeAmenity')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </section>
      )}
    </section>
  );
}