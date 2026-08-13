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
import { Checkbox } from './ui/checkbox';
import { Field, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  AdminDataTable,
  AdminDestructiveActionDialog,
  AdminEmptyState,
  AdminFormSection,
  AdminFormSheet,
  AdminLoadingState,
  AdminPageHeader,
  AdminRowActions,
  AdminStatusBadge,
  AdminTab,
  AdminTabContent,
  AdminTabList,
  AdminTabs,
} from './admin/admin-ui';

const QUARTER_HOUR_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});
const DURATION_OPTIONS = Array.from({ length: 93 }, (_, index) => 60 + index * 15);
const PRIORITY_OPTIONS = Array.from({ length: 101 }, (_, index) => index * 10);

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatDuration(locale: Locale, minutes: number): string {
  return translate(locale, 'ratePlan.duration', {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
}

function statusLabel(locale: Locale, status: RatePlan['status']): string {
  return translate(locale, `ratePlan.status.${status}` as 'ratePlan.status.ACTIVE');
}

const ratePlanNameKeys = {
  DAY_COMBO: 'ratePlan.name.DAY_COMBO',
  EARLY_BIRD_FLEX: 'ratePlan.name.EARLY_BIRD_FLEX',
  EXTRA_HOUR: 'ratePlan.name.EXTRA_HOUR',
  FIVE_HOUR_COMBO: 'ratePlan.name.FIVE_HOUR_COMBO',
  LUNCH_COMBO: 'ratePlan.name.LUNCH_COMBO',
  NIGHT_COMBO: 'ratePlan.name.NIGHT_COMBO',
  THREE_HOUR_COMBO: 'ratePlan.name.THREE_HOUR_COMBO',
} as const;

function localizedPlanName(locale: Locale, plan: RatePlan): string {
  const key = ratePlanNameKeys[plan.code as keyof typeof ratePlanNameKeys];
  return key === undefined ? plan.name : translate(locale, key);
}

interface SelectionDraft {
  includedDurationMinutes: number;
  priority: number;
  minCheckInMinuteInclusive: string;
  maxCheckInMinuteExclusive: string;
  minDurationMinutesInclusive: number;
  maxDurationMinutesInclusive: number;
  dirty: boolean;
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

function selectionDraftFromPlan(plan: RatePlan): SelectionDraft {
  return {
    includedDurationMinutes: plan.includedDurationMinutes,
    priority: plan.priority,
    minCheckInMinuteInclusive:
      plan.minCheckInMinuteInclusive === null ? '' : minutesToTime(plan.minCheckInMinuteInclusive),
    maxCheckInMinuteExclusive:
      plan.maxCheckInMinuteExclusive === null ? '' : minutesToTime(plan.maxCheckInMinuteExclusive),
    minDurationMinutesInclusive: plan.minDurationMinutesInclusive ?? 60,
    maxDurationMinutesInclusive: plan.maxDurationMinutesInclusive ?? 1440,
    dirty: false,
  };
}

function selectionCommand(plan: RatePlan, draft: SelectionDraft): RatePlanSelectionRuleCommand {
  const command: RatePlanSelectionRuleCommand = {};
  if (draft.includedDurationMinutes !== plan.includedDurationMinutes)
    command.includedDurationMinutes = draft.includedDurationMinutes;
  if (draft.priority !== plan.priority) command.priority = draft.priority;
  if (plan.isBasePlan) {
    const min =
      draft.minCheckInMinuteInclusive === ''
        ? null
        : (timeToMinutes(draft.minCheckInMinuteInclusive) ?? null);
    const max =
      draft.maxCheckInMinuteExclusive === ''
        ? null
        : (timeToMinutes(draft.maxCheckInMinuteExclusive) ?? null);
    if (min !== plan.minCheckInMinuteInclusive) command.minCheckInMinuteInclusive = min;
    if (max !== plan.maxCheckInMinuteExclusive) command.maxCheckInMinuteExclusive = max;
    if (draft.minDurationMinutesInclusive !== plan.minDurationMinutesInclusive)
      command.minDurationMinutesInclusive = draft.minDurationMinutesInclusive;
    if (draft.maxDurationMinutesInclusive !== plan.maxDurationMinutesInclusive)
      command.maxDurationMinutesInclusive = draft.maxDurationMinutesInclusive;
  }
  return command;
}

export function RatePlanManager() {
  const locale = useLocale();
  const [plans, setPlans] = useState<readonly RatePlan[]>();
  const [priceTiers, setPriceTiers] = useState<readonly PriceTier[]>([]);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [priceEditId, setPriceEditId] = useState<string>();
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [selectionEditId, setSelectionEditId] = useState<string>();
  const [deactivateCandidate, setDeactivateCandidate] = useState<RatePlan>();
  const [createDraft, setCreateDraft] = useState<CreateDraft>(initialCreateDraft);
  const [selectionDrafts, setSelectionDrafts] = useState<Record<string, SelectionDraft>>({});

  const load = () => {
    void Promise.all([adminApi.listRatePlans(), adminApi.listPriceTiers()])
      .then(([planPage, tierPage]) => {
        setPlans(planPage.items);
        setPriceTiers(tierPage.items);
        setSelectionDrafts(
          Object.fromEntries(planPage.items.map((plan) => [plan.id, selectionDraftFromPlan(plan)])),
        );
      })
      .catch(() => setMessage(translate(locale, 'ratePlan.loadError')));
  };
  useEffect(load, [locale]);

  const sortedPlans = useMemo(
    () =>
      plans === undefined ? undefined : [...plans].sort((a, b) => a.code.localeCompare(b.code)),
    [plans],
  );
  const priceTierById = useMemo(
    () => new Map(priceTiers.map((tier) => [tier.id, tier] as const)),
    [priceTiers],
  );

  async function changeStatus(plan: RatePlan, activate: boolean) {
    setPending(true);
    try {
      const next = activate
        ? await adminApi.activateRatePlan(plan.id)
        : await adminApi.inactivateRatePlan(plan.id);
      setPlans((current) => current?.map((item) => (item.id === plan.id ? next : item)));
      setDeactivateCandidate(undefined);
    } catch {
      setMessage(translate(locale, 'ratePlan.statusError'));
    } finally {
      setPending(false);
    }
  }

  async function createPlan() {
    const code = createDraft.code.trim().toUpperCase();
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
    try {
      await adminApi.createRatePlan(command);
      setCreateDraft(initialCreateDraft);
      setCreateOpen(false);
      setMessage(translate(locale, 'ratePlan.created'));
      load();
    } catch {
      setMessage(translate(locale, 'ratePlan.createError'));
    } finally {
      setCreating(false);
    }
  }

  async function savePrice(planId: string, tierId: string, rawAmount: string) {
    const amountVnd = Number(rawAmount);
    if (!Number.isInteger(amountVnd) || amountVnd <= 0) {
      setMessage(translate(locale, 'ratePlan.invalidPrice'));
      return;
    }
    setPending(true);
    try {
      await adminApi.updateRatePlanPrice(planId, tierId, amountVnd);
      load();
    } catch {
      setMessage(translate(locale, 'ratePlan.priceSaveError'));
    } finally {
      setPending(false);
    }
  }

  async function saveSelection(plan: RatePlan): Promise<boolean> {
    const draft = selectionDrafts[plan.id];
    if (draft === undefined) return false;
    const command = selectionCommand(plan, draft);
    if (Object.keys(command).length === 0) {
      setMessage(translate(locale, 'ratePlan.noChanges'));
      return false;
    }
    setPending(true);
    try {
      const next = await adminApi.updateRatePlanSelectionRule(plan.id, command);
      setPlans((current) => current?.map((item) => (item.id === plan.id ? next : item)));
      setSelectionDrafts((current) => ({ ...current, [plan.id]: selectionDraftFromPlan(next) }));
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

  function patchSelection(id: string, patch: Partial<SelectionDraft>) {
    setSelectionDrafts((current) =>
      current[id] === undefined
        ? current
        : { ...current, [id]: { ...current[id], ...patch, dirty: true } },
    );
  }

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
        <AdminTabs defaultValue="overview" className="admin-form-tabs">
          <AdminTabList>
            <AdminTab value="overview">{translate(locale, 'ratePlan.overview')}</AdminTab>
            <AdminTab value="rules">{translate(locale, 'ratePlan.selectionLegend')}</AdminTab>
          </AdminTabList>
          <AdminTabContent value="overview">
            <AdminFormSection
              title={translate(locale, 'ratePlan.details')}
              description={translate(locale, 'ratePlan.createHelp')}
            >
              <Field>
                <FieldLabel htmlFor="rate-plan-code">
                  {translate(locale, 'ratePlan.code')}
                </FieldLabel>
                <Input
                  id="rate-plan-code"
                  aria-label={translate(locale, 'ratePlan.code')}
                  value={createDraft.code}
                  disabled={creating}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, code: event.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rate-plan-name">
                  {translate(locale, 'ratePlan.name')}
                </FieldLabel>
                <Input
                  id="rate-plan-name"
                  aria-label={translate(locale, 'ratePlan.name')}
                  value={createDraft.name}
                  disabled={creating}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{translate(locale, 'ratePlan.basePlan')}</FieldLabel>
                <Checkbox
                  aria-label={translate(locale, 'ratePlan.basePlan')}
                  checked={createDraft.isBasePlan}
                  onCheckedChange={(checked) =>
                    setCreateDraft((current) => ({ ...current, isBasePlan: checked === true }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel>{translate(locale, 'ratePlan.includedDurationLabel')}</FieldLabel>
                <DurationSelect
                  ariaLabel={translate(locale, 'ratePlan.includedDurationLabel')}
                  value={createDraft.includedDurationMinutes}
                  onChange={(value) =>
                    setCreateDraft((current) => ({ ...current, includedDurationMinutes: value }))
                  }
                  locale={locale}
                />
              </Field>
              <Field>
                <FieldLabel>{translate(locale, 'ratePlan.priority')}</FieldLabel>
                <PrioritySelect
                  ariaLabel={translate(locale, 'ratePlan.priority')}
                  value={createDraft.priority}
                  onChange={(value) =>
                    setCreateDraft((current) => ({ ...current, priority: value }))
                  }
                />
              </Field>
            </AdminFormSection>
          </AdminTabContent>
          <AdminTabContent value="rules">
            <AdminFormSection title={translate(locale, 'ratePlan.rulesHeading')}>
              <TimeSelect
                label={translate(locale, 'ratePlan.checkInStart')}
                value={createDraft.minCheckInMinuteInclusive}
                locale={locale}
                disabled={!createDraft.isBasePlan}
                onChange={(value) =>
                  setCreateDraft((current) => ({ ...current, minCheckInMinuteInclusive: value }))
                }
              />
              <TimeSelect
                label={translate(locale, 'ratePlan.checkInEnd')}
                value={createDraft.maxCheckInMinuteExclusive}
                locale={locale}
                disabled={!createDraft.isBasePlan}
                onChange={(value) =>
                  setCreateDraft((current) => ({ ...current, maxCheckInMinuteExclusive: value }))
                }
              />
              <Field>
                <FieldLabel>{translate(locale, 'ratePlan.minimumDuration')}</FieldLabel>
                <DurationSelect
                  value={createDraft.minDurationMinutesInclusive}
                  disabled={!createDraft.isBasePlan}
                  onChange={(value) =>
                    setCreateDraft((current) => ({
                      ...current,
                      minDurationMinutesInclusive: value,
                    }))
                  }
                  locale={locale}
                />
              </Field>
              <Field>
                <FieldLabel>{translate(locale, 'ratePlan.maximumDuration')}</FieldLabel>
                <DurationSelect
                  value={createDraft.maxDurationMinutesInclusive}
                  disabled={!createDraft.isBasePlan}
                  onChange={(value) =>
                    setCreateDraft((current) => ({
                      ...current,
                      maxDurationMinutesInclusive: value,
                    }))
                  }
                  locale={locale}
                />
              </Field>
            </AdminFormSection>
          </AdminTabContent>
        </AdminTabs>
        <Button disabled={creating} onClick={() => void createPlan()}>
          {translate(locale, 'ratePlan.createDraft')}
        </Button>
      </AdminFormSheet>
      {sortedPlans === undefined ? (
        <AdminLoadingState label={translate(locale, 'ratePlan.loading')} />
      ) : sortedPlans.length === 0 ? (
        <AdminEmptyState title={translate(locale, 'ratePlan.empty')} />
      ) : (
        <AdminDataTable variant="management" className="admin-rate-plan-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate(locale, 'ratePlan.name')}</TableHead>
                <TableHead>{translate(locale, 'ratePlan.code')}</TableHead>
                <TableHead>{translate(locale, 'ratePlan.type')}</TableHead>
                <TableHead>{translate(locale, 'ratePlan.timeWindow')}</TableHead>
                <TableHead>{translate(locale, 'ratePlan.durationLabel')}</TableHead>
                <TableHead>{translate(locale, 'admin.priceTiers')}</TableHead>
                <TableHead>{translate(locale, 'admin.amount')}</TableHead>
                <TableHead>{translate(locale, 'ratePlan.priority')}</TableHead>
                <TableHead>{translate(locale, 'admin.status')}</TableHead>
                <TableHead>{translate(locale, 'ratePlan.validation')}</TableHead>
                <TableHead>{translate(locale, 'admin.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlans.map((plan) => {
                const displayName = localizedPlanName(locale, plan);
                const configured = plan.prices.filter((price) => price.amountVnd !== null).length;
                const total = plan.prices.length;
                return (
                  <TableRow
                    key={plan.id}
                    role="article"
                    aria-label={`${plan.code} ${plan.name} ${displayName}`}
                  >
                    <TableCell>
                      <strong>{displayName}</strong>
                    </TableCell>
                    <TableCell>
                      <span className="admin-code">{plan.code}</span>
                    </TableCell>
                    <TableCell>
                      {translate(
                        locale,
                        plan.isBasePlan ? 'ratePlan.baseType' : 'ratePlan.extraHourType',
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.isBasePlan &&
                      plan.minCheckInMinuteInclusive !== null &&
                      plan.maxCheckInMinuteExclusive !== null
                        ? `${minutesToTime(plan.minCheckInMinuteInclusive)}–${minutesToTime(plan.maxCheckInMinuteExclusive)}`
                        : translate(locale, 'ratePlan.anyTime')}
                    </TableCell>
                    <TableCell>{formatDuration(locale, plan.includedDurationMinutes)}</TableCell>
                    <TableCell>{total}</TableCell>
                    <TableCell>
                      {configured === 0
                        ? translate(locale, 'ratePlan.unconfigured')
                        : formatVnd(
                            locale,
                            Math.min(
                              ...plan.prices
                                .filter((price) => price.amountVnd !== null)
                                .map((price) => price.amountVnd as number),
                            ),
                          )}
                    </TableCell>
                    <TableCell>{plan.priority}</TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge
                        tone={configured === total && total > 0 ? 'success' : 'warning'}
                      >
                        {translate(locale, 'ratePlan.pricesConfigured', { configured, total })}
                      </AdminStatusBadge>
                    </TableCell>
                    <TableCell>
                      <AdminRowActions
                        actions={[
                          {
                            label: translate(locale, 'ratePlan.savePrice'),
                            onSelect: () => setPriceEditId(plan.id),
                          },
                          ...(plan.isBasePlan
                            ? [
                                {
                                  label: translate(locale, 'ratePlan.selectionLegend'),
                                  onSelect: () => setSelectionEditId(plan.id),
                                },
                              ]
                            : []),
                          {
                            label: translate(
                              locale,
                              plan.status === 'ACTIVE' ? 'admin.deactivate' : 'admin.activate',
                            ),
                            destructive: plan.status === 'ACTIVE',
                            onSelect: () =>
                              plan.status === 'ACTIVE'
                                ? setDeactivateCandidate(plan)
                                : void changeStatus(plan, true),
                            disabled: pending,
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </AdminDataTable>
      )}
      <AdminDestructiveActionDialog
        open={deactivateCandidate !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeactivateCandidate(undefined);
        }}
        title={translate(locale, 'admin.deactivate')}
        description={
          deactivateCandidate === undefined
            ? ''
            : `${localizedPlanName(locale, deactivateCandidate)} · ${deactivateCandidate.code}`
        }
        confirmLabel={translate(locale, 'admin.deactivate')}
        pending={pending}
        onConfirm={() => {
          if (deactivateCandidate !== undefined) void changeStatus(deactivateCandidate, false);
        }}
      />
      {priceEditId !== undefined
        ? (() => {
            const plan = sortedPlans?.find((candidate) => candidate.id === priceEditId);
            if (plan === undefined) return null;
            return (
              <AdminFormSheet
                open
                onOpenChange={(open) => !open && setPriceEditId(undefined)}
                title={translate(locale, 'ratePlan.savePrice')}
                description={`${localizedPlanName(locale, plan)} · ${plan.code}`}
              >
                <AdminTabs defaultValue="price">
                  <AdminTabList>
                    <AdminTab value="price">{translate(locale, 'ratePlan.priceByTier')}</AdminTab>
                    <AdminTab value="validation">
                      {translate(locale, 'ratePlan.validation')}
                    </AdminTab>
                  </AdminTabList>
                  <AdminTabContent value="price">
                    <AdminFormSection
                      title={translate(locale, 'ratePlan.priceByTier')}
                      description={translate(locale, 'ratePlan.priceDescription')}
                    >
                      {plan.prices.map((price) => {
                        const priceDraftKey = `${plan.id}:${price.priceTierId}`;
                        const tierName =
                          priceTierById.get(price.priceTierId)?.name ??
                          translate(locale, 'ratePlan.unknownPriceTier');
                        return (
                          <div className="admin-price-editor" key={price.priceTierId}>
                            <Field>
                              <FieldLabel>{tierName}</FieldLabel>
                              <Input
                                aria-label={`${translate(locale, 'admin.amount')} ${plan.name} ${tierName}`}
                                disabled={pending || plan.status === 'INACTIVE'}
                                inputMode="numeric"
                                min="1"
                                onChange={(event) =>
                                  setPriceDrafts((current) => ({
                                    ...current,
                                    [priceDraftKey]: event.target.value,
                                  }))
                                }
                                type="number"
                                value={
                                  priceDrafts[priceDraftKey] ??
                                  (price.amountVnd === null ? '' : String(price.amountVnd))
                                }
                              />
                            </Field>
                            <span className="admin-muted">
                              {price.amountVnd === null
                                ? translate(locale, 'ratePlan.unconfigured')
                                : formatVnd(locale, price.amountVnd)}
                            </span>
                            <Button
                              disabled={pending || plan.status === 'INACTIVE'}
                              onClick={(event) => {
                                const input = event.currentTarget
                                  .closest('.admin-price-editor')
                                  ?.querySelector('input');
                                if (input instanceof HTMLInputElement)
                                  void savePrice(plan.id, price.priceTierId, input.value);
                              }}
                              type="button"
                            >
                              {translate(locale, 'ratePlan.savePrice')}
                            </Button>
                          </div>
                        );
                      })}
                    </AdminFormSection>
                  </AdminTabContent>
                  <AdminTabContent value="validation">
                    <AdminFormSection title={translate(locale, 'ratePlan.validationHeading')}>
                      <p>
                        {plan.prices.filter((price) => price.amountVnd !== null).length ===
                        plan.prices.length
                          ? translate(locale, 'ratePlan.validationComplete')
                          : translate(locale, 'ratePlan.validationIncomplete')}
                      </p>
                      <p className="admin-muted">{translate(locale, 'ratePlan.changeHistory')}</p>
                    </AdminFormSection>
                  </AdminTabContent>
                </AdminTabs>
              </AdminFormSheet>
            );
          })()
        : null}
      {selectionEditId !== undefined
        ? (() => {
            const plan = sortedPlans?.find((candidate) => candidate.id === selectionEditId);
            const draft = plan === undefined ? undefined : selectionDrafts[plan.id];
            if (plan === undefined || draft === undefined || !plan.isBasePlan) return null;
            return (
              <AdminFormSheet
                open
                onOpenChange={(open) => !open && setSelectionEditId(undefined)}
                title={translate(locale, 'ratePlan.selectionLegend')}
                description={localizedPlanName(locale, plan)}
                footer={
                  <Button
                    disabled={pending || !draft.dirty}
                    onClick={() =>
                      void saveSelection(plan).then(
                        (saved) => saved && setSelectionEditId(undefined),
                      )
                    }
                  >
                    {translate(locale, 'ratePlan.saveSelection')}
                  </Button>
                }
              >
                <AdminTabs defaultValue="time">
                  <AdminTabList>
                    <AdminTab value="time">{translate(locale, 'ratePlan.timeWindow')}</AdminTab>
                    <AdminTab value="duration">
                      {translate(locale, 'ratePlan.durationLabel')}
                    </AdminTab>
                    <AdminTab value="priority">{translate(locale, 'ratePlan.priority')}</AdminTab>
                  </AdminTabList>
                  <AdminTabContent value="time">
                    <AdminFormSection title={translate(locale, 'ratePlan.checkInWindowHeading')}>
                      <Field>
                        <FieldLabel>
                          {translate(locale, 'ratePlan.includedDurationLabel')}
                        </FieldLabel>
                        <DurationSelect
                          value={draft.includedDurationMinutes}
                          onChange={(value) =>
                            patchSelection(plan.id, { includedDurationMinutes: value })
                          }
                          locale={locale}
                        />
                      </Field>
                      <TimeSelect
                        label={translate(locale, 'ratePlan.checkInStart')}
                        value={draft.minCheckInMinuteInclusive}
                        locale={locale}
                        onChange={(value) =>
                          patchSelection(plan.id, { minCheckInMinuteInclusive: value })
                        }
                      />
                      <TimeSelect
                        label={translate(locale, 'ratePlan.checkInEnd')}
                        value={draft.maxCheckInMinuteExclusive}
                        locale={locale}
                        onChange={(value) =>
                          patchSelection(plan.id, { maxCheckInMinuteExclusive: value })
                        }
                      />
                      <Field>
                        <FieldLabel>{translate(locale, 'ratePlan.priority')}</FieldLabel>
                        <PrioritySelect
                          value={draft.priority}
                          onChange={(value) => patchSelection(plan.id, { priority: value })}
                        />
                      </Field>
                    </AdminFormSection>
                  </AdminTabContent>
                  <AdminTabContent value="duration">
                    <AdminFormSection title={translate(locale, 'ratePlan.durationLabel')}>
                      <Field>
                        <FieldLabel>
                          {translate(locale, 'ratePlan.includedDurationLabel')}
                        </FieldLabel>
                        <DurationSelect
                          value={draft.includedDurationMinutes}
                          onChange={(value) =>
                            patchSelection(plan.id, { includedDurationMinutes: value })
                          }
                          locale={locale}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{translate(locale, 'ratePlan.minimumDuration')}</FieldLabel>
                        <DurationSelect
                          value={draft.minDurationMinutesInclusive}
                          onChange={(value) =>
                            patchSelection(plan.id, { minDurationMinutesInclusive: value })
                          }
                          locale={locale}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{translate(locale, 'ratePlan.maximumDuration')}</FieldLabel>
                        <DurationSelect
                          value={draft.maxDurationMinutesInclusive}
                          onChange={(value) =>
                            patchSelection(plan.id, { maxDurationMinutesInclusive: value })
                          }
                          locale={locale}
                        />
                      </Field>
                    </AdminFormSection>
                  </AdminTabContent>
                  <AdminTabContent value="priority">
                    <AdminFormSection title={translate(locale, 'ratePlan.priority')}>
                      <Field>
                        <FieldLabel>{translate(locale, 'ratePlan.priority')}</FieldLabel>
                        <PrioritySelect
                          value={draft.priority}
                          onChange={(value) => patchSelection(plan.id, { priority: value })}
                        />
                      </Field>
                    </AdminFormSection>
                  </AdminTabContent>
                </AdminTabs>
              </AdminFormSheet>
            );
          })()
        : null}
    </section>
  );
}

function DurationSelect({
  value,
  onChange,
  disabled = false,
  locale,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  locale: Locale;
  ariaLabel?: string;
}) {
  return (
    <Select
      disabled={disabled}
      value={String(value)}
      onValueChange={(next) => next !== null && onChange(Number(next))}
    >
      <SelectTrigger className="w-full" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {DURATION_OPTIONS.map((minutes) => (
            <SelectItem key={minutes} value={String(minutes)}>
              {formatDuration(locale, minutes)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function PrioritySelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(next) => next !== null && onChange(Number(next))}>
      <SelectTrigger className="w-full" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {PRIORITY_OPTIONS.map((priority) => (
            <SelectItem key={priority} value={String(priority)}>
              {priority}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
  locale,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        disabled={disabled}
        value={value || '__any__'}
        onValueChange={(next) => next !== null && onChange(next === '__any__' ? '' : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="__any__">{translate(locale, 'ratePlan.anyTime')}</SelectItem>
            {QUARTER_HOUR_OPTIONS.map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
