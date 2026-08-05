'use client';
import type { Amenity, PriceTier, RoomType } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';
import { AdminApiError, adminApi, type CatalogPage } from '../lib/admin-api';
import { localizedCatalogSafetyReason } from '../lib/catalog-safety';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
} from './admin/admin-ui';

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

function roomTypeStatusLabel(locale: 'vi' | 'en', status: RoomType['status']): string {
  return translate(
    locale,
    status === 'ACTIVE' ? 'roomType.status.ACTIVE' : 'roomType.status.INACTIVE',
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string>();
  const [amenityOpen, setAmenityOpen] = useState(false);

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
      setCreateOpen(false);
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
    } catch (cause) {
      const text =
        cause instanceof AdminApiError && cause.problem?.code !== undefined
          ? localizedCatalogSafetyReason(locale, cause.problem.code, cause.problem.detail)
          : translate(locale, 'roomType.archiveError');
      setMessage(text);
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

  async function saveDraft(id: string): Promise<boolean> {
    const draft = drafts[id];
    if (draft === undefined) return false;
    if (!isCapacityValid(draft)) {
      setErrors((current) => ({ ...current, [id]: translate(locale, 'roomType.invalidCapacity') }));
      return false;
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
      return true;
    } catch (cause) {
      const text =
        cause instanceof AdminApiError && cause.problem?.code !== undefined
          ? localizedCatalogSafetyReason(locale, cause.problem.code, cause.problem.detail)
          : translate(locale, 'roomType.updateError');
      setErrors((current) => ({ ...current, [id]: text }));
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page admin-page--room-types">
      <AdminPageHeader
        title={translate(locale, 'admin.roomTypes')}
        description={translate(locale, 'roomType.help')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            {translate(locale, 'roomType.create')}
          </Button>
        }
      />
      <AdminFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={translate(locale, 'roomType.create')}
        description={translate(locale, 'roomType.help')}
      >
        <form className="admin-form-stack" onSubmit={create}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="room-type-price-tier">
                {translate(locale, 'roomType.priceTier')}
              </FieldLabel>
              <Select
                disabled={pending || tiers.length === 0}
                value={priceTierId}
                onValueChange={(value) => {
                  if (value !== null) setPriceTierId(value);
                }}
              >
                <SelectTrigger id="room-type-price-tier" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <FieldLabel htmlFor="room-type-max-adults">
                {translate(locale, 'roomType.maxAdults')}
              </FieldLabel>
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
              <FieldLabel htmlFor="room-type-max-children">
                {translate(locale, 'roomType.maxChildren')}
              </FieldLabel>
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
              <FieldLabel htmlFor="room-type-max-occupancy">
                {translate(locale, 'roomType.maxOccupancy')}
              </FieldLabel>
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
      </AdminFormSheet>
      {editId !== undefined
        ? (() => {
            const roomType = types?.items.find((item) => item.id === editId);
            if (roomType === undefined) return null;
            const draft = drafts[roomType.id] ?? draftFromRoomType(roomType, priceTierId);
            const error = errors[roomType.id];
            return (
              <AdminFormSheet
                open
                onOpenChange={(open) => {
                  if (!open) setEditId(undefined);
                }}
                title={translate(locale, 'roomType.saveChanges')}
                description={roomType.code}
                footer={
                  <Button
                    disabled={pending || !isCapacityValid(draft)}
                    onClick={() =>
                      void saveDraft(roomType.id).then((saved) => {
                        if (saved) setEditId(undefined);
                      })
                    }
                  >
                    {translate(locale, 'roomType.saveChanges')}
                  </Button>
                }
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="room-type-edit-name">
                      {translate(locale, 'roomType.name')}
                    </FieldLabel>
                    <Input
                      id="room-type-edit-name"
                      onChange={(event) => updateDraft(roomType.id, { name: event.target.value })}
                      required
                      value={draft.name}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="room-type-edit-description">
                      {translate(locale, 'roomType.description')}
                    </FieldLabel>
                    <Input
                      id="room-type-edit-description"
                      onChange={(event) =>
                        updateDraft(roomType.id, { description: event.target.value })
                      }
                      value={draft.description}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="room-type-edit-tier">
                      {translate(locale, 'roomType.priceTier')}
                    </FieldLabel>
                    <Select
                      value={draft.priceTierId}
                      onValueChange={(value) => {
                        if (value !== null) updateDraft(roomType.id, { priceTierId: value });
                      }}
                    >
                      <SelectTrigger id="room-type-edit-tier" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tiers.map((tier) => (
                          <SelectItem key={tier.id} value={tier.id}>
                            {tier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="room-type-edit-adults">
                      {translate(locale, 'roomType.maxAdults')}
                    </FieldLabel>
                    <Input
                      id="room-type-edit-adults"
                      min={1}
                      onChange={(event) =>
                        updateDraft(roomType.id, { maxAdults: Number(event.target.value) })
                      }
                      type="number"
                      value={draft.maxAdults}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="room-type-edit-children">
                      {translate(locale, 'roomType.maxChildren')}
                    </FieldLabel>
                    <Input
                      id="room-type-edit-children"
                      min={0}
                      onChange={(event) =>
                        updateDraft(roomType.id, { maxChildren: Number(event.target.value) })
                      }
                      type="number"
                      value={draft.maxChildren}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="room-type-edit-occupancy">
                      {translate(locale, 'roomType.maxOccupancy')}
                    </FieldLabel>
                    <Input
                      id="room-type-edit-occupancy"
                      min={1}
                      onChange={(event) =>
                        updateDraft(roomType.id, { maxOccupancy: Number(event.target.value) })
                      }
                      type="number"
                      value={draft.maxOccupancy}
                    />
                  </Field>
                  {error !== undefined && error !== '' ? (
                    <Alert variant="destructive">
                      <AlertTitle>{translate(locale, 'roomType.updateError')}</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                </FieldGroup>
              </AdminFormSheet>
            );
          })()
        : null}
      {message === undefined ? null : <p role="alert">{message}</p>}
      {types === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : null}
      {types !== undefined && types.items.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'catalog.noResults')} />
      ) : null}
      {types === undefined || types.items.length === 0 ? null : (
        <AdminDataTable>
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
                return (
                  <tr key={roomType.id} data-testid={`room-type-row-${roomType.code}`}>
                    <td>{roomType.code}</td>
                    <td>{roomType.name}</td>
                    <td>
                      {roomType.maxAdults}/{roomType.maxChildren}/{roomType.maxOccupancy}
                    </td>
                    <td>
                      <AdminStatusBadge tone={roomType.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {roomTypeStatusLabel(locale, roomType.status)}
                      </AdminStatusBadge>
                    </td>
                    <td>
                      <Button onClick={() => setEditId(roomType.id)} size="sm" variant="outline">
                        {translate(locale, 'roomType.saveChanges')}
                      </Button>
                      <Button
                        aria-label={translate(locale, 'amenity.archive', { name: roomType.name })}
                        disabled={pending || roomType.status === 'INACTIVE'}
                        onClick={() => void archive(roomType.id)}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        {translate(locale, 'catalog.archive')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminDataTable>
      )}
      <div className="admin-secondary-action">
        <Button type="button" variant="outline" onClick={() => setAmenityOpen(true)}>
          {translate(locale, 'roomType.assignAmenity')}
        </Button>
      </div>
      <AdminFormSheet
        open={amenityOpen}
        onOpenChange={setAmenityOpen}
        title={translate(locale, 'roomType.assignAmenity')}
        description={translate(locale, 'roomType.removeAmenity')}
      >
        <form onSubmit={assignAmenity} className="admin-form-stack">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="room-type-assign-target">
                {translate(locale, 'roomType.assignTarget')}
              </FieldLabel>
              <Select
                disabled={pending || types?.items.length === 0}
                value={amenityRoomTypeId}
                onValueChange={(value) => {
                  if (value !== null) setAmenityRoomTypeId(value);
                }}
              >
                <SelectTrigger id="room-type-assign-target" className="w-full">
                  <SelectValue>
                    {types?.items.find((type) => type.id === amenityRoomTypeId)?.name ??
                      translate(locale, 'roomType.assignTarget')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(types?.items ?? [])
                    .filter((type) => type.status === 'ACTIVE')
                    .map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="room-type-assign-amenity">
                {translate(locale, 'admin.amenities')}
              </FieldLabel>
              <Select
                disabled={pending || amenities.length === 0}
                value={amenityId}
                onValueChange={(value) => {
                  if (value !== null) setAmenityId(value);
                }}
              >
                <SelectTrigger id="room-type-assign-amenity" className="w-full">
                  <SelectValue>
                    {amenities.find((amenity) => amenity.id === amenityId)?.name ??
                      translate(locale, 'admin.amenities')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {amenities.map((amenity) => (
                    <SelectItem key={amenity.id} value={amenity.id}>
                      {amenity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              disabled={pending || amenityRoomTypeId === '' || amenityId === ''}
              type="submit"
            >
              {translate(locale, 'roomType.assignAmenity')}
            </Button>
          </FieldGroup>
        </form>
        <div className="admin-form-section">
          <h2>{translate(locale, 'roomType.removeAmenity')}</h2>
          <div className="admin-amenity-removal-list">
            {types?.items
              .filter((type) => type.status === 'ACTIVE')
              .map((type) => (
                <div key={type.id}>
                  <strong>{type.name}</strong>
                  <div className="admin-row-actions">
                    {amenities.map((amenity) => (
                      <Button
                        key={`${type.id}-${amenity.id}`}
                        aria-label={translate(locale, 'roomType.removeAmenity')}
                        disabled={pending}
                        onClick={() => void removeAmenity(type.id, amenity.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {amenity.name} <XIcon aria-hidden="true" />
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </AdminFormSheet>
    </section>
  );
}
