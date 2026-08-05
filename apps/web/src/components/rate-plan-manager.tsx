'use client';
import { useEffect, useMemo, useState } from 'react';
import type {
  PriceTier,
  RatePlan,
  RatePlanCreateCommand,
  RatePlanSelectionRuleCommand,
} from '@room/contracts';
import { AdminApiError, adminApi } from '../lib/admin-api';
import { formatVnd, translate, type Locale } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  AdminEmptyState,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
} from './admin/admin-ui';

const QUARTER_HOUR_OPTIONS = (() => {
  const options: string[] = [];
  for (let hour = 0; hour <= 23; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options.push(value);
    }
  }
  return options;
})();

const DURATION_OPTIONS = (() => {
  const options: number[] = [];
  for (let minutes = 60; minutes <= 1440; minutes += 15) {
    options.push(minutes);
  }
  return options;
})();

const PRIORITY_OPTIONS = (() => {
  const options: number[] = [];
  for (let priority = 0; priority <= 1000; priority += 10) {
    options.push(priority);
  }
  return options;
})();

function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute % 15 !== 0) return undefined;
  return hour * 60 + minute;
}

function formatDuration(locale: Locale, minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return translate(locale, 'ratePlan.duration', { hours: hour, minutes: minute });
}

function summarisePlan(locale: Locale, plan: RatePlan): string {
  if (!plan.isBasePlan) {
    return translate(locale, 'ratePlan.extraHourSummary');
  }
  const windowText =
    plan.minCheckInMinuteInclusive === null || plan.maxCheckInMinuteExclusive === null
      ? translate(locale, 'ratePlan.anyTime')
      : translate(locale, 'ratePlan.checkInWindow', {
          from: minutesToTime(plan.minCheckInMinuteInclusive),
          to: minutesToTime(plan.maxCheckInMinuteExclusive),
        });
  const durationText = translate(locale, 'ratePlan.durationRange', {
    min: formatDuration(locale, plan.minDurationMinutesInclusive ?? 60),
    max: formatDuration(locale, plan.maxDurationMinutesInclusive ?? 1440),
  });
  const includedText = translate(locale, 'ratePlan.includedDuration', {
    duration: formatDuration(locale, plan.includedDurationMinutes),
  });
  const extraText = translate(locale, 'ratePlan.extraHourSummary');
  const priorityText = translate(locale, 'ratePlan.priorityValue', { priority: plan.priority });
  return [windowText, durationText, includedText, extraText, priorityText].join(' ');
}

interface SelectionRuleDraft {
  includedDurationMinutes: number;
  priority: number;
  minCheckInMinuteInclusive: string;
  maxCheckInMinuteExclusive: string;
  minDurationMinutesInclusive: number;
  maxDurationMinutesInclusive: number;
  isDirty: boolean;
}

interface CreateDraft {
  code: string;
  name: string;
  includedDurationMinutes: number;
  priority: number;
  isBasePlan: boolean;
  minCheckInMinuteInclusive: string;
  maxCheckInMinuteExclusive: string;
  minDurationMinutesInclusive: number;
  maxDurationMinutesInclusive: number;
}

const initialCreateDraft: CreateDraft = {
  code: '',
  name: '',
  includedDurationMinutes: 180,
  priority: 10,
  isBasePlan: true,
  minCheckInMinuteInclusive: '',
  maxCheckInMinuteExclusive: '',
  minDurationMinutesInclusive: 60,
  maxDurationMinutesInclusive: 1440,
};

function draftFromPlan(plan: RatePlan): SelectionRuleDraft {
  return {
    includedDurationMinutes: plan.includedDurationMinutes,
    priority: plan.priority,
    minCheckInMinuteInclusive:
      plan.minCheckInMinuteInclusive === null ? '' : minutesToTime(plan.minCheckInMinuteInclusive),
    maxCheckInMinuteExclusive:
      plan.maxCheckInMinuteExclusive === null ? '' : minutesToTime(plan.maxCheckInMinuteExclusive),
    minDurationMinutesInclusive: plan.minDurationMinutesInclusive ?? 60,
    maxDurationMinutesInclusive: plan.maxDurationMinutesInclusive ?? 1440,
    isDirty: false,
  };
}

function draftsFromPlans(plans: readonly RatePlan[]): Record<string, SelectionRuleDraft> {
  return Object.fromEntries(plans.map((plan) => [plan.id, draftFromPlan(plan)]));
}

function statusLabel(locale: Locale, status: RatePlan['status']): string {
  switch (status) {
    case 'DRAFT':
      return translate(locale, 'ratePlan.status.DRAFT');
    case 'ACTIVE':
      return translate(locale, 'ratePlan.status.ACTIVE');
    case 'INACTIVE':
      return translate(locale, 'ratePlan.status.INACTIVE');
  }
}

function draftToCommand(plan: RatePlan, draft: SelectionRuleDraft): RatePlanSelectionRuleCommand {
  const command: RatePlanSelectionRuleCommand = {};
  if (draft.includedDurationMinutes !== plan.includedDurationMinutes) {
    command.includedDurationMinutes = draft.includedDurationMinutes;
  }
  if (draft.priority !== plan.priority) {
    command.priority = draft.priority;
  }
  if (plan.isBasePlan) {
    const nextMin =
      draft.minCheckInMinuteInclusive === ''
        ? null
        : timeToMinutes(draft.minCheckInMinuteInclusive);
    const nextMax =
      draft.maxCheckInMinuteExclusive === ''
        ? null
        : timeToMinutes(draft.maxCheckInMinuteExclusive);
    if (nextMin !== plan.minCheckInMinuteInclusive) {
      command.minCheckInMinuteInclusive = nextMin;
    }
    if (nextMax !== plan.maxCheckInMinuteExclusive) {
      command.maxCheckInMinuteExclusive = nextMax;
    }
    if (draft.minDurationMinutesInclusive !== plan.minDurationMinutesInclusive) {
      command.minDurationMinutesInclusive = draft.minDurationMinutesInclusive;
    }
    if (draft.maxDurationMinutesInclusive !== plan.maxDurationMinutesInclusive) {
      command.maxDurationMinutesInclusive = draft.maxDurationMinutesInclusive;
    }
  }
  return command;
}

export function RatePlanManager() {
  const locale = useLocale();
  const [plans, setPlans] = useState<readonly RatePlan[]>();
  const [priceTiers, setPriceTiers] = useState<readonly PriceTier[]>([]);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, SelectionRuleDraft>>({});
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(initialCreateDraft);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectionEditId, setSelectionEditId] = useState<string>();
  const [priceEditId, setPriceEditId] = useState<string>();
  const load = () =>
    void Promise.all([adminApi.listRatePlans(), adminApi.listPriceTiers()])
      .then(([result, tierPage]) => {
        setPlans(result.items);
        setPriceTiers(tierPage.items);
        setDrafts(draftsFromPlans(result.items));
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof AdminApiError
            ? translate(locale, 'ratePlan.loadError')
            : translate(locale, 'ratePlan.loadError'),
        ),
      );
  useEffect(load, [locale]);

  async function changeStatus(plan: RatePlan, activate: boolean) {
    setPending(true);
    setMessage(undefined);
    try {
      const next = activate
        ? await adminApi.activateRatePlan(plan.id)
        : await adminApi.inactivateRatePlan(plan.id);
      setPlans((current) => current?.map((item) => (item.id === plan.id ? next : item)));
    } catch (error) {
      setMessage(
        error instanceof AdminApiError
          ? translate(locale, 'ratePlan.statusError')
          : translate(locale, 'ratePlan.statusError'),
      );
    } finally {
      setPending(false);
    }
  }
  async function submitCreate() {
    const code = createDraft.code.trim();
    if (!/^[A-Z0-9_]{1,64}$/.test(code)) {
      setMessage(translate(locale, 'ratePlan.invalidCode'));
      return;
    }
    if (createDraft.name.trim() === '') {
      setMessage(translate(locale, 'ratePlan.nameRequired'));
      return;
    }
    const command: RatePlanCreateCommand = {
      code,
      name: createDraft.name.trim(),
      includedDurationMinutes: createDraft.includedDurationMinutes,
      priority: createDraft.priority,
      isBasePlan: createDraft.isBasePlan,
      minCheckInMinuteInclusive:
        createDraft.minCheckInMinuteInclusive === ''
          ? null
          : (timeToMinutes(createDraft.minCheckInMinuteInclusive) ?? null),
      maxCheckInMinuteExclusive:
        createDraft.maxCheckInMinuteExclusive === ''
          ? null
          : (timeToMinutes(createDraft.maxCheckInMinuteExclusive) ?? null),
      minDurationMinutesInclusive: createDraft.isBasePlan
        ? createDraft.minDurationMinutesInclusive
        : null,
      maxDurationMinutesInclusive: createDraft.isBasePlan
        ? createDraft.maxDurationMinutesInclusive
        : null,
    };
    setCreating(true);
    setMessage(undefined);
    try {
      await adminApi.createRatePlan(command);
      setCreateDraft(initialCreateDraft);
      setMessage(translate(locale, 'ratePlan.created'));
      setCreateOpen(false);
      load();
    } catch (error) {
      setMessage(
        error instanceof AdminApiError
          ? translate(locale, 'ratePlan.createError')
          : translate(locale, 'ratePlan.createError'),
      );
    } finally {
      setCreating(false);
    }
  }
  async function savePrice(planId: string, tierId: string, raw: string) {
    const amountVnd = Number(raw);
    if (!Number.isInteger(amountVnd) || amountVnd <= 0) {
      setMessage(translate(locale, 'ratePlan.invalidPrice'));
      return;
    }
    setPending(true);
    try {
      await adminApi.updateRatePlanPrice(planId, tierId, amountVnd);
      load();
    } catch (error) {
      setMessage(
        error instanceof AdminApiError
          ? translate(locale, 'ratePlan.priceSaveError')
          : translate(locale, 'ratePlan.priceSaveError'),
      );
    } finally {
      setPending(false);
    }
  }
  function updateDraft(planId: string, patch: Partial<SelectionRuleDraft>) {
    setDrafts((current) => {
      const currentDraft = current[planId];
      if (currentDraft === undefined) return current;
      return { ...current, [planId]: { ...currentDraft, ...patch, isDirty: true } };
    });
  }
  async function saveSelectionRule(plan: RatePlan): Promise<boolean> {
    const draft = drafts[plan.id];
    if (draft === undefined) return false;
    const command = draftToCommand(plan, draft);
    if (Object.keys(command).length === 0) {
      setMessage(translate(locale, 'ratePlan.noChanges'));
      return false;
    }
    setPending(true);
    setMessage(undefined);
    try {
      const next = await adminApi.updateRatePlanSelectionRule(plan.id, command);
      setPlans((current) => current?.map((item) => (item.id === plan.id ? next : item)));
      setDrafts((current) => ({ ...current, [plan.id]: draftFromPlan(next) }));
      setMessage(translate(locale, 'ratePlan.selectionSaved'));
      return true;
    } catch (error) {
      setMessage(
        error instanceof AdminApiError
          ? error.problem.detail
          : translate(locale, 'ratePlan.selectionSaveError'),
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  const sortedPlans = useMemo(
    () =>
      plans === undefined ? undefined : [...plans].sort((a, b) => a.code.localeCompare(b.code)),
    [plans],
  );
  const priceTierById = useMemo(
    () => new Map(priceTiers.map((tier) => [tier.id, tier] as const)),
    [priceTiers],
  );
  return (
    <section className="admin-page admin-page--rate-plans">
      <AdminPageHeader
        title={translate(locale, 'ratePlan.heading')}
        description={translate(locale, 'ratePlan.help')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            {translate(locale, 'ratePlan.createDraft')}
          </Button>
        }
      />
      {message ? <p role="alert">{message}</p> : null}
      <AdminFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={translate(locale, 'ratePlan.createLegend')}
        description={translate(locale, 'ratePlan.createHelp')}
      >
        <fieldset className="admin-form-stack">
          <legend>{translate(locale, 'ratePlan.createLegend')}</legend>
          <p>{translate(locale, 'ratePlan.createHelp')}</p>
          <label>
            {translate(locale, 'ratePlan.code')}
            <Input
              aria-label={translate(locale, 'ratePlan.code')}
              disabled={creating}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, code: event.target.value }))
              }
              value={createDraft.code}
            />
          </label>{' '}
          <label>
            {translate(locale, 'ratePlan.name')}
            <Input
              aria-label={translate(locale, 'ratePlan.name')}
              disabled={creating}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, name: event.target.value }))
              }
              value={createDraft.name}
            />
          </label>{' '}
          <label>
            {translate(locale, 'ratePlan.basePlan')}
            <Checkbox
              aria-label={translate(locale, 'ratePlan.basePlan')}
              checked={createDraft.isBasePlan}
              disabled={creating}
              onCheckedChange={(checked) =>
                setCreateDraft((current) => ({ ...current, isBasePlan: checked === true }))
              }
            />
          </label>{' '}
          <label>
            {translate(locale, 'ratePlan.includedDurationLabel')}
            <Select
              disabled={creating}
              value={String(createDraft.includedDurationMinutes)}
              onValueChange={(value) => {
                if (value !== null)
                  setCreateDraft((current) => ({
                    ...current,
                    includedDurationMinutes: Number(value),
                  }));
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label={translate(locale, 'ratePlan.includedDurationLabel')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {formatDuration(locale, minutes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>{' '}
          <label>
            {translate(locale, 'ratePlan.checkInStart')}
            <Select
              disabled={creating || !createDraft.isBasePlan}
              value={createDraft.minCheckInMinuteInclusive || '__any__'}
              onValueChange={(value) => {
                if (value !== null)
                  setCreateDraft((current) => ({
                    ...current,
                    minCheckInMinuteInclusive: value === '__any__' ? '' : value,
                  }));
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label={translate(locale, 'ratePlan.checkInStart')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">{translate(locale, 'ratePlan.anyTime')}</SelectItem>
                {QUARTER_HOUR_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>{' '}
          <label>
            {translate(locale, 'ratePlan.checkInEnd')}
            <Select
              disabled={creating || !createDraft.isBasePlan}
              value={createDraft.maxCheckInMinuteExclusive || '__any__'}
              onValueChange={(value) => {
                if (value !== null)
                  setCreateDraft((current) => ({
                    ...current,
                    maxCheckInMinuteExclusive: value === '__any__' ? '' : value,
                  }));
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label={translate(locale, 'ratePlan.checkInEnd')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">{translate(locale, 'ratePlan.anyTime')}</SelectItem>
                {QUARTER_HOUR_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>{' '}
          <label>
            {translate(locale, 'ratePlan.minimumDuration')}
            <Select
              disabled={creating || !createDraft.isBasePlan}
              value={String(createDraft.minDurationMinutesInclusive)}
              onValueChange={(value) => {
                if (value !== null)
                  setCreateDraft((current) => ({
                    ...current,
                    minDurationMinutesInclusive: Number(value),
                  }));
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label={translate(locale, 'ratePlan.minimumDuration')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {formatDuration(locale, minutes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>{' '}
          <label>
            {translate(locale, 'ratePlan.maximumDuration')}
            <Select
              disabled={creating || !createDraft.isBasePlan}
              value={String(createDraft.maxDurationMinutesInclusive)}
              onValueChange={(value) => {
                if (value !== null)
                  setCreateDraft((current) => ({
                    ...current,
                    maxDurationMinutesInclusive: Number(value),
                  }));
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label={translate(locale, 'ratePlan.maximumDuration')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {formatDuration(locale, minutes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>{' '}
          <label>
            {translate(locale, 'ratePlan.priority')}
            <Select
              disabled={creating}
              value={String(createDraft.priority)}
              onValueChange={(value) => {
                if (value !== null)
                  setCreateDraft((current) => ({ ...current, priority: Number(value) }));
              }}
            >
              <SelectTrigger className="w-full" aria-label={translate(locale, 'ratePlan.priority')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((priority) => (
                  <SelectItem key={priority} value={String(priority)}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>{' '}
          <Button disabled={creating} onClick={() => void submitCreate()} type="button">
            {translate(locale, 'ratePlan.createDraft')}
          </Button>
        </fieldset>
      </AdminFormSheet>
      {sortedPlans === undefined ? (
        <AdminLoadingState label={translate(locale, 'ratePlan.loading')} />
      ) : sortedPlans.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'ratePlan.empty')} />
      ) : (
        <div className="admin-rate-plan-list">
          {sortedPlans.map((plan) => {
            return (
              <article
                className="admin-rate-plan-row"
                key={plan.id}
                aria-labelledby={`rate-plan-${plan.id}`}
              >
                <h2 id={`rate-plan-${plan.id}`}>
                  {plan.name}
                  <span className="admin-muted">{plan.code}</span>
                </h2>
                <p>
                  {translate(locale, 'admin.status')}:{' '}
                  <AdminStatusBadge
                    tone={
                      plan.status === 'ACTIVE'
                        ? 'success'
                        : plan.status === 'DRAFT'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {statusLabel(locale, plan.status)}
                  </AdminStatusBadge>
                  {plan.isBasePlan ? null : ` — ${translate(locale, 'ratePlan.extraHourSummary')}`}
                </p>
                <p>{summarisePlan(locale, plan)}</p>
                <ul>
                  {plan.prices.map((price) => (
                    <li key={price.priceTierId}>
                      <label>
                        {translate(locale, 'roomType.priceTier')}{' '}
                        {priceTierById.get(price.priceTierId)?.name ??
                          translate(locale, 'ratePlan.unknownPriceTier')}
                        <Input
                          key={`${plan.id}-${price.priceTierId}-${price.amountVnd ?? ''}`}
                          aria-label={`${translate(locale, 'admin.amount')} ${plan.name} ${priceTierById.get(price.priceTierId)?.name ?? translate(locale, 'ratePlan.unknownPriceTier')}`}
                          defaultValue={price.amountVnd ?? ''}
                          disabled={pending || plan.status === 'INACTIVE'}
                          inputMode="numeric"
                          min="1"
                          type="number"
                        />
                      </label>{' '}
                      {price.amountVnd === null
                        ? translate(locale, 'ratePlan.unconfigured')
                        : formatVnd(locale, price.amountVnd)}{' '}
                      <Button
                        disabled={pending || plan.status === 'INACTIVE'}
                        onClick={(event) =>
                          void savePrice(
                            plan.id,
                            price.priceTierId,
                            (
                              event.currentTarget.previousElementSibling?.querySelector(
                                'input',
                              ) as HTMLInputElement
                            ).value,
                          )
                        }
                        type="button"
                      >
                        {translate(locale, 'ratePlan.savePrice')}
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="admin-rate-plan-actions">
                  <Button onClick={() => setPriceEditId(plan.id)} size="sm" variant="outline">
                    {translate(locale, 'ratePlan.savePrice')}
                  </Button>
                  {plan.isBasePlan ? (
                    <Button onClick={() => setSelectionEditId(plan.id)} size="sm" variant="outline">
                      {translate(locale, 'ratePlan.selectionLegend')}
                    </Button>
                  ) : null}
                  <Button
                    disabled={pending || plan.status === 'ACTIVE'}
                    onClick={() => void changeStatus(plan, true)}
                    type="button"
                  >
                    {translate(locale, 'ratePlan.activate')}
                  </Button>{' '}
                  <Button
                    disabled={pending || plan.status === 'INACTIVE'}
                    onClick={() => void changeStatus(plan, false)}
                    type="button"
                  >
                    {translate(locale, 'ratePlan.deactivate')}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {priceEditId !== undefined
        ? (() => {
            const plan = sortedPlans?.find((candidate) => candidate.id === priceEditId);
            if (plan === undefined) return null;
            return (
              <AdminFormSheet
                open
                onOpenChange={(open) => {
                  if (!open) setPriceEditId(undefined);
                }}
                title={translate(locale, 'ratePlan.savePrice')}
                description={`${plan.name} · ${plan.code}`}
              >
                <div className="admin-form-stack">
                  <p className="admin-supporting-text">{summarisePlan(locale, plan)}</p>
                  {plan.prices.map((price) => {
                    const tierName =
                      priceTierById.get(price.priceTierId)?.name ??
                      translate(locale, 'ratePlan.unknownPriceTier');
                    return (
                      <div className="admin-price-editor" key={price.priceTierId}>
                        <label>
                          {tierName}
                          <Input
                            key={`${plan.id}-${price.priceTierId}-${price.amountVnd ?? ''}`}
                            aria-label={`${translate(locale, 'admin.amount')} ${plan.name} ${tierName}`}
                            defaultValue={price.amountVnd ?? ''}
                            disabled={pending || plan.status === 'INACTIVE'}
                            inputMode="numeric"
                            min="1"
                            type="number"
                          />
                        </label>
                        <span className="admin-muted">
                          {price.amountVnd === null
                            ? translate(locale, 'ratePlan.unconfigured')
                            : formatVnd(locale, price.amountVnd)}
                        </span>
                        <Button
                          disabled={pending || plan.status === 'INACTIVE'}
                          onClick={(event) =>
                            void savePrice(
                              plan.id,
                              price.priceTierId,
                              (
                                event.currentTarget.previousElementSibling?.previousElementSibling?.querySelector(
                                  'input',
                                ) as HTMLInputElement
                              ).value,
                            )
                          }
                          type="button"
                        >
                          {translate(locale, 'ratePlan.savePrice')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </AdminFormSheet>
            );
          })()
        : null}
      {selectionEditId !== undefined
        ? (() => {
            const plan = sortedPlans?.find((candidate) => candidate.id === selectionEditId);
            if (plan === undefined || !plan.isBasePlan) return null;
            const draft = drafts[plan.id] ?? draftFromPlan(plan);
            return (
              <AdminFormSheet
                open
                onOpenChange={(open) => {
                  if (!open) setSelectionEditId(undefined);
                }}
                title={translate(locale, 'ratePlan.selectionLegend')}
                description={plan.name}
                footer={
                  <Button
                    disabled={pending || !draft.isDirty}
                    onClick={() =>
                      void saveSelectionRule(plan).then((saved) => {
                        if (saved) setSelectionEditId(undefined);
                      })
                    }
                  >
                    {translate(locale, 'ratePlan.saveSelection')}
                  </Button>
                }
              >
                <div className="admin-form-stack">
                  <label>
                    {translate(locale, 'ratePlan.includedDurationLabel')}
                    <Select
                      value={String(draft.includedDurationMinutes)}
                      onValueChange={(value) => {
                        if (value !== null)
                          updateDraft(plan.id, { includedDurationMinutes: Number(value) });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {formatDuration(locale, minutes)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    {translate(locale, 'ratePlan.checkInStart')}
                    <Select
                      value={draft.minCheckInMinuteInclusive || '__any__'}
                      onValueChange={(value) => {
                        if (value !== null)
                          updateDraft(plan.id, {
                            minCheckInMinuteInclusive: value === '__any__' ? '' : value,
                          });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">
                          {translate(locale, 'ratePlan.anyTime')}
                        </SelectItem>
                        {QUARTER_HOUR_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    {translate(locale, 'ratePlan.checkInEnd')}
                    <Select
                      value={draft.maxCheckInMinuteExclusive || '__any__'}
                      onValueChange={(value) => {
                        if (value !== null)
                          updateDraft(plan.id, {
                            maxCheckInMinuteExclusive: value === '__any__' ? '' : value,
                          });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">
                          {translate(locale, 'ratePlan.anyTime')}
                        </SelectItem>
                        {QUARTER_HOUR_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    {translate(locale, 'ratePlan.minimumDuration')}
                    <Select
                      value={String(draft.minDurationMinutesInclusive)}
                      onValueChange={(value) => {
                        if (value !== null)
                          updateDraft(plan.id, { minDurationMinutesInclusive: Number(value) });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {formatDuration(locale, minutes)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    {translate(locale, 'ratePlan.maximumDuration')}
                    <Select
                      value={String(draft.maxDurationMinutesInclusive)}
                      onValueChange={(value) => {
                        if (value !== null)
                          updateDraft(plan.id, { maxDurationMinutesInclusive: Number(value) });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {formatDuration(locale, minutes)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    {translate(locale, 'ratePlan.priority')}
                    <Select
                      value={String(draft.priority)}
                      onValueChange={(value) => {
                        if (value !== null) updateDraft(plan.id, { priority: Number(value) });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((priority) => (
                          <SelectItem key={priority} value={String(priority)}>
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  {draft.isDirty ? (
                    <span className="admin-muted" aria-live="polite">
                      {translate(locale, 'ratePlan.unsavedChanges')}
                    </span>
                  ) : null}
                </div>
              </AdminFormSheet>
            );
          })()
        : null}
    </section>
  );
}
