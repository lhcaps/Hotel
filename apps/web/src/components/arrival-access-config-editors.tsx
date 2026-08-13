'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type { PropertyArrivalAccessConfig, RoomArrivalAccessConfig } from '@room/contracts';

import { AdminApiError, adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { Alert, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { AdminFormSection, AdminLoadingState } from './admin/admin-ui';
import { useLocale } from './locale-provider';

const MANAGE_PERMISSION = 'arrival.access.manage';
const READ_PERMISSION = 'arrival.access.read';

function messageFor(locale: ReturnType<typeof useLocale>, error: unknown): string {
  return error instanceof AdminApiError
    ? translate(locale, 'arrivalAccess.updateError')
    : translate(locale, 'arrivalAccess.loadError');
}

export function PropertyArrivalAccessEditor() {
  const locale = useLocale();
  const [config, setConfig] = useState<PropertyArrivalAccessConfig>();
  const [allowed, setAllowed] = useState<boolean>();
  const [gatePass, setGatePass] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [supportContact, setSupportContact] = useState('');
  const [instructions, setInstructions] = useState('');
  const [preparationNote, setPreparationNote] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  function hydrate(next: PropertyArrivalAccessConfig) {
    setConfig(next);
    setWifiSsid(next.wifiSsid ?? '');
    setSupportContact(next.supportContact ?? '');
    setInstructions(next.defaultArrivalInstruction ?? '');
    setPreparationNote(next.preparationNote ?? '');
    setGatePass('');
    setWifiPassword('');
  }

  useEffect(() => {
    let active = true;
    void adminApi
      .me()
      .then(async (actor) => {
        if (!active) return;
        const canRead = actor.permissions.includes(READ_PERMISSION);
        setAllowed(canRead && actor.permissions.includes(MANAGE_PERMISSION));
        if (!canRead) return;
        hydrate(await adminApi.getPropertyArrivalAccessConfig());
      })
      .catch((error: unknown) => {
        if (active) setMessage(messageFor(locale, error));
      });
    return () => {
      active = false;
    };
  }, [locale]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowed) return;
    setPending(true);
    setMessage(undefined);
    try {
      const next = await adminApi.updatePropertyArrivalAccessConfig({
        ...(gatePass === '' ? {} : { gatePass: { action: 'REPLACE', value: gatePass } }),
        ...(wifiPassword === ''
          ? {}
          : { wifiPassword: { action: 'REPLACE', value: wifiPassword } }),
        wifiSsid: wifiSsid === '' ? null : wifiSsid,
        supportContact: supportContact === '' ? null : supportContact,
        defaultArrivalInstruction: instructions === '' ? null : instructions,
        preparationNote: preparationNote === '' ? null : preparationNote,
      });
      hydrate(next);
      setMessage(translate(locale, 'arrivalAccess.propertySaved'));
    } catch (error) {
      setMessage(messageFor(locale, error));
    } finally {
      setPending(false);
    }
  }

  async function clearSecret(field: 'gatePass' | 'wifiPassword') {
    if (!allowed) return;
    setPending(true);
    setMessage(undefined);
    try {
      const next = await adminApi.updatePropertyArrivalAccessConfig({
        [field]: { action: 'CLEAR' },
      });
      hydrate(next);
      setMessage(translate(locale, 'arrivalAccess.propertySecretCleared'));
    } catch (error) {
      setMessage(messageFor(locale, error));
    } finally {
      setPending(false);
    }
  }

  if (allowed === false) return null;
  if (allowed === undefined || config === undefined) {
    return message === undefined ? (
      <AdminLoadingState label={translate(locale, 'arrivalAccess.propertyLoading')} />
    ) : null;
  }

  return (
    <form className="admin-form-stack" onSubmit={save}>
      <AdminFormSection title={translate(locale, 'arrivalAccess.propertyTitle')}>
        <p className="text-sm text-slate-600">{translate(locale, 'arrivalAccess.propertyHelp')}</p>
        <Field>
          <FieldLabel htmlFor="arrival-gate-pass">
            {translate(locale, 'arrivalAccess.gatePass')}
          </FieldLabel>
          <Input
            autoComplete="new-password"
            disabled={pending || !allowed}
            id="arrival-gate-pass"
            onChange={(event) => setGatePass(event.target.value)}
            placeholder={translate(
              locale,
              config.gatePassConfigured
                ? 'arrivalAccess.secretConfigured'
                : 'arrivalAccess.secretUnconfigured',
            )}
            type="password"
            value={gatePass}
          />
          {config.gatePassConfigured ? (
            <Button
              disabled={pending || !allowed}
              onClick={() => void clearSecret('gatePass')}
              type="button"
              variant="outline"
            >
              {translate(locale, 'arrivalAccess.clearGatePass')}
            </Button>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="arrival-wifi-ssid">
            {translate(locale, 'arrivalAccess.wifiSsid')}
          </FieldLabel>
          <Input
            disabled={pending || !allowed}
            id="arrival-wifi-ssid"
            onChange={(event) => setWifiSsid(event.target.value)}
            value={wifiSsid}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="arrival-wifi-password">
            {translate(locale, 'arrivalAccess.wifiPassword')}
          </FieldLabel>
          <Input
            autoComplete="new-password"
            disabled={pending || !allowed}
            id="arrival-wifi-password"
            onChange={(event) => setWifiPassword(event.target.value)}
            placeholder={translate(
              locale,
              config.wifiPasswordConfigured
                ? 'arrivalAccess.secretConfigured'
                : 'arrivalAccess.secretUnconfigured',
            )}
            type="password"
            value={wifiPassword}
          />
          {config.wifiPasswordConfigured ? (
            <Button
              disabled={pending || !allowed}
              onClick={() => void clearSecret('wifiPassword')}
              type="button"
              variant="outline"
            >
              {translate(locale, 'arrivalAccess.clearWifiPassword')}
            </Button>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="arrival-support">
            {translate(locale, 'arrivalAccess.supportContact')}
          </FieldLabel>
          <Input
            disabled={pending || !allowed}
            id="arrival-support"
            onChange={(event) => setSupportContact(event.target.value)}
            value={supportContact}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="arrival-instructions">
            {translate(locale, 'arrivalAccess.defaultInstructions')}
          </FieldLabel>
          <Textarea
            disabled={pending || !allowed}
            id="arrival-instructions"
            onChange={(event) => setInstructions(event.target.value)}
            value={instructions}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="arrival-preparation">
            {translate(locale, 'arrivalAccess.preparationNote')}
          </FieldLabel>
          <Textarea
            disabled={pending || !allowed}
            id="arrival-preparation"
            onChange={(event) => setPreparationNote(event.target.value)}
            value={preparationNote}
          />
        </Field>
      </AdminFormSection>
      <FieldGroup>
        <Button disabled={pending || !allowed} type="submit">
          {translate(locale, pending ? 'arrivalAccess.saving' : 'arrivalAccess.saveProperty')}
        </Button>
      </FieldGroup>
      {message === undefined ? null : (
        <Alert>
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      )}
    </form>
  );
}

export function RoomArrivalAccessEditor({ roomId }: { readonly roomId: string }) {
  const locale = useLocale();
  const [config, setConfig] = useState<RoomArrivalAccessConfig>();
  const [allowed, setAllowed] = useState<boolean>();
  const [roomPass, setRoomPass] = useState('');
  const [roomLocation, setRoomLocation] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  function hydrate(next: RoomArrivalAccessConfig) {
    setConfig(next);
    setRoomPass('');
    setRoomLocation(next.roomLocation ?? '');
    setInstructions(next.arrivalInstruction ?? '');
  }

  useEffect(() => {
    let active = true;
    void adminApi
      .me()
      .then(async (actor) => {
        if (!active) return;
        const canRead = actor.permissions.includes(READ_PERMISSION);
        setAllowed(canRead && actor.permissions.includes(MANAGE_PERMISSION));
        if (!canRead) return;
        hydrate(await adminApi.getRoomArrivalAccessConfig(roomId));
      })
      .catch((error: unknown) => {
        if (active) setMessage(messageFor(locale, error));
      });
    return () => {
      active = false;
    };
  }, [locale, roomId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowed) return;
    setPending(true);
    setMessage(undefined);
    try {
      const next = await adminApi.updateRoomArrivalAccessConfig(roomId, {
        ...(roomPass === '' ? {} : { roomPass: { action: 'REPLACE', value: roomPass } }),
        roomLocation: roomLocation === '' ? null : roomLocation,
        arrivalInstruction: instructions === '' ? null : instructions,
      });
      hydrate(next);
      setMessage(translate(locale, 'arrivalAccess.roomSaved'));
    } catch (error) {
      setMessage(messageFor(locale, error));
    } finally {
      setPending(false);
    }
  }

  async function clearSecret() {
    if (!allowed) return;
    setPending(true);
    setMessage(undefined);
    try {
      const next = await adminApi.updateRoomArrivalAccessConfig(roomId, {
        roomPass: { action: 'CLEAR' },
      });
      hydrate(next);
      setMessage(translate(locale, 'arrivalAccess.roomSecretCleared'));
    } catch (error) {
      setMessage(messageFor(locale, error));
    } finally {
      setPending(false);
    }
  }

  if (allowed === false) return null;
  if (allowed === undefined || config === undefined) {
    return message === undefined ? (
      <AdminLoadingState label={translate(locale, 'arrivalAccess.roomLoading')} />
    ) : null;
  }

  return (
    <form className="admin-form-stack mt-6" onSubmit={save}>
      <AdminFormSection title={translate(locale, 'arrivalAccess.roomTitle')}>
        <p className="text-sm text-slate-600">{translate(locale, 'arrivalAccess.roomHelp')}</p>
        <Field>
          <FieldLabel htmlFor={`room-pass-${roomId}`}>
            {translate(locale, 'arrivalAccess.roomPass')}
          </FieldLabel>
          <Input
            autoComplete="new-password"
            disabled={pending || !allowed}
            id={`room-pass-${roomId}`}
            onChange={(event) => setRoomPass(event.target.value)}
            placeholder={translate(
              locale,
              config.roomPassConfigured
                ? 'arrivalAccess.secretConfigured'
                : 'arrivalAccess.secretUnconfigured',
            )}
            type="password"
            value={roomPass}
          />
          {config.roomPassConfigured ? (
            <Button
              disabled={pending || !allowed}
              onClick={() => void clearSecret()}
              type="button"
              variant="outline"
            >
              {translate(locale, 'arrivalAccess.clearRoomPass')}
            </Button>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor={`room-location-${roomId}`}>
            {translate(locale, 'arrivalAccess.roomLocation')}
          </FieldLabel>
          <Input
            disabled={pending || !allowed}
            id={`room-location-${roomId}`}
            onChange={(event) => setRoomLocation(event.target.value)}
            value={roomLocation}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`room-arrival-${roomId}`}>
            {translate(locale, 'arrivalAccess.roomInstructions')}
          </FieldLabel>
          <Textarea
            disabled={pending || !allowed}
            id={`room-arrival-${roomId}`}
            onChange={(event) => setInstructions(event.target.value)}
            value={instructions}
          />
        </Field>
      </AdminFormSection>
      <FieldGroup>
        <Button disabled={pending || !allowed} type="submit">
          {translate(locale, pending ? 'arrivalAccess.saving' : 'arrivalAccess.saveRoom')}
        </Button>
      </FieldGroup>
      {message === undefined ? null : (
        <Alert>
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      )}
    </form>
  );
}
