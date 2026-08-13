'use client';
import type { Amenity, PriceTier, Room, RoomType } from '@room/contracts';
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
import { Table } from './ui/table';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminRowActions,
  AdminStatusBadge,
} from './admin/admin-ui';

interface RoomTypeEditDraft {
  readonly name: string;
  readonly description: string;
  readonly capacity: 2 | 4; // Simplified: 2 or 4 guests
  readonly priceTierId: string;
}

const emptyDraft: RoomTypeEditDraft = {
  name: '',
  description: '',
  capacity: 2,
  priceTierId: '',
};

function draftFromRoomType(roomType: RoomType, fallbackTierId: string): RoomTypeEditDraft {
  // Map existing maxOccupancy to simplified 2 or 4 capacity model
  const capacity = roomType.maxOccupancy <= 2 ? 2 : 4;
  return {
    name: roomType.name,
    description: roomType.description ?? '',
    capacity: capacity as 2 | 4,
    priceTierId: roomType.priceTierId ?? fallbackTierId,
  };
}

// Convert simplified capacity to backend fields for compatibility
function capacityToBackendFields(capacity: 2 | 4) {
  if (capacity === 2) {
    return { maxAdults: 2, maxChildren: 0, maxOccupancy: 2 };
  }
  return { maxAdults: 4, maxChildren: 0, maxOccupancy: 4 };
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
  const [rooms, setRooms] = useState<readonly Pick<Room, 'roomTypeId' | 'status'>[]>([]);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [priceTierId, setPriceTierId] = useState('');
  const [amenityId, setAmenityId] = useState('');
  const [amenityRoomTypeId, setAmenityRoomTypeId] = useState('');
  const [createCapacity, setCreateCapacity] = useState<2 | 4>(2);
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
      adminApi.listRooms(),
    ])
      .then(([roomTypes, priceTiers, amenityPage, roomPage]) => {
        setTypes(roomTypes);
        setTiers(priceTiers.items);
        setAmenities(amenityPage.items.filter((amenity) => amenity.status === 'ACTIVE'));
        setRooms(roomPage.items);
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
      const backendFields = capacityToBackendFields(createCapacity);
      const roomType = await adminApi.createRoomType({
        priceTierId,
        code,
        name,
        ...backendFields,
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
    setPending(true);
    setMessage(undefined);
    setErrors((current) => ({ ...current, [id]: '' }));
    try {
      const backendFields = capacityToBackendFields(draft.capacity);
      const updated = await adminApi.updateRoomType(id, {
        name: draft.name,
        description: draft.description === '' ? null : draft.description,
        ...backendFields,
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
              <FieldLabel htmlFor="room-type-capacity">
                {translate(locale, 'roomType.capacity')}
              </FieldLabel>
              <Select
                disabled={pending}
                onValueChange={(value) => setCreateCapacity(Number(value) as 2 | 4)}
                required
                value={String(createCapacity)}
              >
                <SelectTrigger id="room-type-capacity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 {translate(locale, 'roomType.guests')}</SelectItem>
                  <SelectItem value="4">4 {translate(locale, 'roomType.guests')}</SelectItem>
                </SelectContent>
              </Select>
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
                    disabled={pending}
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
                    <FieldLabel htmlFor="room-type-edit-capacity">
                      {translate(locale, 'roomType.capacity')}
                    </FieldLabel>
                    <Select
                      value={String(draft.capacity)}
                      onValueChange={(value) => {
                        updateDraft(roomType.id, { capacity: Number(value) as 2 | 4 });
                      }}
                    >
                      <SelectTrigger id="room-type-edit-capacity" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 {translate(locale, 'roomType.guests')}</SelectItem>
                        <SelectItem value="4">4 {translate(locale, 'roomType.guests')}</SelectItem>
                      </SelectContent>
                    </Select>
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
        <AdminDataTable variant="management" className="admin-room-types-table">
          <Table>
            <thead>
              <tr>
                <th scope="col">{translate(locale, 'admin.thumbnail')}</th>
                <th scope="col">{translate(locale, 'admin.code')}</th>
                <th scope="col">{translate(locale, 'roomType.name')}</th>
                <th scope="col">{translate(locale, 'roomType.priceTier')}</th>
                <th scope="col">{translate(locale, 'admin.activeRooms')}</th>
                <th scope="col">{translate(locale, 'roomType.capacity')}</th>
                <th scope="col">{translate(locale, 'admin.publication')}</th>
                <th scope="col">{translate(locale, 'admin.status')}</th>
                <th scope="col">{translate(locale, 'admin.action')}</th>
              </tr>
            </thead>
            <tbody>
              {types.items.map((roomType) => {
                return (
                  <tr key={roomType.id} data-testid={`room-type-row-${roomType.code}`}>
                    <td data-label={translate(locale, 'admin.thumbnail')}>
                      <span
                        className="admin-thumbnail-placeholder"
                        aria-label={translate(locale, 'admin.thumbnail')}
                      >
                        —
                      </span>
                    </td>
                    <td data-label={translate(locale, 'admin.code')}>{roomType.code}</td>
                    <td data-label={translate(locale, 'roomType.name')}>
                      <strong>{roomType.name}</strong>
                    </td>
                    <td data-label={translate(locale, 'roomType.priceTier')}>
                      {tiers.find((tier) => tier.id === roomType.priceTierId)?.name ?? '—'}
                    </td>
                    <td data-label={translate(locale, 'admin.activeRooms')}>
                      {
                        rooms.filter(
                          (room) => room.roomTypeId === roomType.id && room.status === 'ACTIVE',
                        ).length
                      }
                    </td>
                    <td data-label={translate(locale, 'roomType.capacity')}>
                      {roomType.maxOccupancy <= 2 ? 2 : 4} {translate(locale, 'roomType.guests')}
                    </td>
                    <td data-label={translate(locale, 'admin.publication')}>
                      <AdminStatusBadge tone={roomType.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {roomType.status === 'ACTIVE'
                          ? translate(locale, 'admin.published')
                          : translate(locale, 'admin.archived')}
                      </AdminStatusBadge>
                    </td>
                    <td data-label={translate(locale, 'admin.status')}>
                      <AdminStatusBadge tone={roomType.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {roomTypeStatusLabel(locale, roomType.status)}
                      </AdminStatusBadge>
                    </td>
                    <td data-label={translate(locale, 'admin.action')}>
                      <AdminRowActions
                        actions={[
                          {
                            label: translate(locale, 'roomType.saveChanges'),
                            onSelect: () => setEditId(roomType.id),
                          },
                          {
                            label: translate(locale, 'catalog.archive'),
                            destructive: true,
                            disabled: pending || roomType.status === 'INACTIVE',
                            onSelect: () => void archive(roomType.id),
                          },
                        ]}
                      >
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
                      </AdminRowActions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
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
