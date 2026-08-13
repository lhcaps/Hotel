'use client';
import type { MaintenanceBlock, Room } from '@room/contracts';
import { type FormEvent, useEffect, useState } from 'react';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { formatDateTime, translate, translateAdminStatus } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from './ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Table } from './ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
} from './admin/admin-ui';
export function MaintenanceManager() {
  const locale = useLocale();
  const [rooms, setRooms] = useState<readonly Room[]>([]);
  const [blocks, setBlocks] = useState<readonly MaintenanceBlock[]>();
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createAttempted, setCreateAttempted] = useState(false);
  const [cancelCandidate, setCancelCandidate] = useState<MaintenanceBlock>();
  const validation = {
    room: roomId === '',
    reason: reason.trim() === '',
    startsAt: startsAt === '',
    endsAt: endsAt === '',
  };
  useEffect(() => {
    void Promise.all([adminApi.listRooms(), adminApi.listMaintenanceBlocks()])
      .then(([roomPage, maintenancePage]) => {
        setRooms(roomPage.items);
        setRoomId(roomPage.items[0]?.id ?? '');
        setBlocks(maintenancePage.items);
      })
      .catch((cause: unknown) =>
        setMessage(
          cause instanceof AdminApiError
            ? translate(locale, 'maintenance.loadError')
            : translate(locale, 'maintenance.loadError'),
        ),
      );
  }, [locale]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateAttempted(true);
    if (Object.values(validation).some(Boolean)) return;
    setPending(true);
    setMessage(undefined);
    try {
      const block = await adminApi.createMaintenanceBlock({
        roomId,
        reason,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setBlocks((current) => (current === undefined ? current : [...current, block]));
      setMessage(translate(locale, 'maintenance.created', { reason: block.reason }));
      setReason('');
      setStartsAt('');
      setEndsAt('');
      setCreateAttempted(false);
      setCreateOpen(false);
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError
          ? translate(locale, 'maintenance.createError')
          : translate(locale, 'maintenance.createError'),
      );
    } finally {
      setPending(false);
    }
  }
  async function cancel(id: string) {
    setPending(true);
    try {
      const block = await adminApi.cancelMaintenanceBlock(id);
      setBlocks((current) =>
        current === undefined
          ? current
          : current.map((candidate) => (candidate.id === id ? block : candidate)),
      );
      setMessage(translate(locale, 'maintenance.cancelled'));
    } catch (cause) {
      setMessage(
        cause instanceof AdminApiError
          ? translate(locale, 'maintenance.cancelError')
          : translate(locale, 'maintenance.cancelError'),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.maintenance')}
        description={translate(locale, 'maintenance.help')}
        actions={
          <Button
            onClick={() => {
              setCreateAttempted(false);
              setCreateOpen(true);
            }}
          >
            {translate(locale, 'maintenance.create')}
          </Button>
        }
      />
      <AdminFormSheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateAttempted(false);
        }}
        title={translate(locale, 'maintenance.create')}
        description={translate(locale, 'maintenance.help')}
      >
        <form className="admin-form-stack" onSubmit={create}>
          <FieldGroup>
            <Field data-invalid={(createAttempted && validation.room) || undefined}>
              <FieldLabel>{translate(locale, 'admin.rooms')}</FieldLabel>
              <Select
                disabled={pending || rooms.length === 0}
                value={roomId}
                onValueChange={(value) => {
                  if (value !== null) setRoomId(value);
                }}
              >
                <SelectTrigger aria-invalid={createAttempted && validation.room} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.roomNumber}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>
                {createAttempted && validation.room
                  ? translate(locale, 'admin.chooseItem')
                  : undefined}
              </FieldError>
            </Field>
            <Field data-invalid={(createAttempted && validation.reason) || undefined}>
              <FieldLabel htmlFor="maintenance-reason">
                {translate(locale, 'maintenance.reason')}
              </FieldLabel>
              <Input
                aria-invalid={createAttempted && validation.reason}
                disabled={pending}
                id="maintenance-reason"
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
              <FieldError>
                {createAttempted && validation.reason
                  ? translate(locale, 'maintenance.reason')
                  : undefined}
              </FieldError>
            </Field>
            <Field data-invalid={(createAttempted && validation.startsAt) || undefined}>
              <FieldLabel htmlFor="maintenance-starts-at">
                {translate(locale, 'maintenance.startsAt')}
              </FieldLabel>
              <Input
                aria-invalid={createAttempted && validation.startsAt}
                disabled={pending}
                id="maintenance-starts-at"
                onChange={(event) => setStartsAt(event.target.value)}
                type="datetime-local"
                value={startsAt}
              />
            </Field>
            <Field data-invalid={(createAttempted && validation.endsAt) || undefined}>
              <FieldLabel htmlFor="maintenance-ends-at">
                {translate(locale, 'maintenance.endsAt')}
              </FieldLabel>
              <Input
                aria-invalid={createAttempted && validation.endsAt}
                disabled={pending}
                id="maintenance-ends-at"
                onChange={(event) => setEndsAt(event.target.value)}
                type="datetime-local"
                value={endsAt}
              />
              <FieldDescription>{translate(locale, 'maintenance.help')}</FieldDescription>
            </Field>
            <Button disabled={pending || roomId === ''} type="submit">
              {translate(locale, 'maintenance.create')}
            </Button>
          </FieldGroup>
        </form>
      </AdminFormSheet>
      {message === undefined ? null : <p role="alert">{message}</p>}
      {blocks === undefined ? (
        <AdminLoadingState label={translate(locale, 'admin.loadingData')} />
      ) : null}
      {blocks !== undefined && blocks.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'catalog.noResults')} />
      ) : null}
      {blocks === undefined || blocks.length === 0 ? null : (
        <AdminDataTable variant="management">
          <Table>
            <thead>
              <tr>
                <th scope="col">{translate(locale, 'maintenance.reason')}</th>
                <th scope="col">{translate(locale, 'maintenance.startsAt')}</th>
                <th scope="col">{translate(locale, 'maintenance.endsAt')}</th>
                <th scope="col">{translate(locale, 'admin.status')}</th>
                <th scope="col">{translate(locale, 'admin.action')}</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => (
                <tr key={block.id}>
                  <td>{block.reason}</td>
                  <td>{formatDateTime(locale, block.startsAt)}</td>
                  <td>{formatDateTime(locale, block.endsAt)}</td>
                  <td>
                    <AdminStatusBadge tone={block.status === 'CANCELLED' ? 'neutral' : 'warning'}>
                      {translateAdminStatus(locale, block.status)}
                    </AdminStatusBadge>
                  </td>
                  <td>
                    <Button
                      aria-label={translate(locale, 'maintenance.cancelLabel', {
                        reason: block.reason,
                      })}
                      disabled={pending || block.status === 'CANCELLED'}
                      onClick={() => setCancelCandidate(block)}
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      {translate(locale, 'maintenance.cancel')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </AdminDataTable>
      )}
      <AlertDialog
        open={cancelCandidate !== undefined}
        onOpenChange={(open) => {
          if (!open) setCancelCandidate(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{translate(locale, 'maintenance.cancel')}</AlertDialogTitle>
            <AlertDialogDescription>{cancelCandidate?.reason}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{translate(locale, 'admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (cancelCandidate !== undefined) void cancel(cancelCandidate.id);
                setCancelCandidate(undefined);
              }}
            >
              {translate(locale, 'maintenance.cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
