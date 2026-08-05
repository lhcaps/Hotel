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
  async function saveSelectionRule(plan: RatePlan) {
    const draft = drafts[plan.id];
    if (draft === undefined) return;
    const command = draftToCommand(plan, draft);
    if (Object.keys(command).length === 0) {
      setMessage(translate(locale, 'ratePlan.noChanges'));
      return;
    }
    setPending(true);
    setMessage(undefined);
    try {
      const next = await adminApi.updateRatePlanSelectionRule(plan.id, command);
      setPlans((current) => current?.map((item) => (item.id === plan.id ? next : item)));
      setDrafts((current) => ({ ...current, [plan.id]: draftFromPlan(next) }));
      setMessage(translate(locale, 'ratePlan.selectionSaved'));
    } catch (error) {
      setMessage(
        error instanceof AdminApiError
          ? error.problem.detail
          : translate(locale, 'ratePlan.selectionSaveError'),
      );
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
      <h1>{translate(locale, 'ratePlan.heading')}</h1>
      <p>{translate(locale, 'ratePlan.help')}</p>
      {message ? <p role="alert">{message}</p> : null}
      <fieldset>
        <legend>{translate(locale, 'ratePlan.createLegend')}</legend>
        <p>{translate(locale, 'ratePlan.createHelp')}</p>
        <label>
          {translate(locale, 'ratePlan.code')}
          <input
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
          <input
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
          <input
            aria-label={translate(locale, 'ratePlan.basePlan')}
            checked={createDraft.isBasePlan}
            disabled={creating}
            onChange={(event) =>
              setCreateDraft((current) => ({ ...current, isBasePlan: event.target.checked }))
            }
            type="checkbox"
          />
        </label>{' '}
        <label>
          {translate(locale, 'ratePlan.includedDurationLabel')}
          <select
            aria-label={translate(locale, 'ratePlan.includedDurationLabel')}
            disabled={creating}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                includedDurationMinutes: Number(event.target.value),
              }))
            }
            value={createDraft.includedDurationMinutes}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(locale, minutes)}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          {translate(locale, 'ratePlan.checkInStart')}
          <select
            aria-label={translate(locale, 'ratePlan.checkInStart')}
            disabled={creating || !createDraft.isBasePlan}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                minCheckInMinuteInclusive: event.target.value,
              }))
            }
            value={createDraft.minCheckInMinuteInclusive}
          >
            <option value="">{translate(locale, 'ratePlan.anyTime')}</option>
            {QUARTER_HOUR_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          {translate(locale, 'ratePlan.checkInEnd')}
          <select
            aria-label={translate(locale, 'ratePlan.checkInEnd')}
            disabled={creating || !createDraft.isBasePlan}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                maxCheckInMinuteExclusive: event.target.value,
              }))
            }
            value={createDraft.maxCheckInMinuteExclusive}
          >
            <option value="">{translate(locale, 'ratePlan.anyTime')}</option>
            {QUARTER_HOUR_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          {translate(locale, 'ratePlan.minimumDuration')}
          <select
            aria-label={translate(locale, 'ratePlan.minimumDuration')}
            disabled={creating || !createDraft.isBasePlan}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                minDurationMinutesInclusive: Number(event.target.value),
              }))
            }
            value={createDraft.minDurationMinutesInclusive}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(locale, minutes)}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          {translate(locale, 'ratePlan.maximumDuration')}
          <select
            aria-label={translate(locale, 'ratePlan.maximumDuration')}
            disabled={creating || !createDraft.isBasePlan}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                maxDurationMinutesInclusive: Number(event.target.value),
              }))
            }
            value={createDraft.maxDurationMinutesInclusive}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(locale, minutes)}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          {translate(locale, 'ratePlan.priority')}
          <select
            aria-label={translate(locale, 'ratePlan.priority')}
            disabled={creating}
            onChange={(event) =>
              setCreateDraft((current) => ({ ...current, priority: Number(event.target.value) }))
            }
            value={createDraft.priority}
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>{' '}
        <button disabled={creating} onClick={() => void submitCreate()} type="button">
          {translate(locale, 'ratePlan.createDraft')}
        </button>
      </fieldset>
      {sortedPlans === undefined ? (
        <p aria-live="polite">{translate(locale, 'ratePlan.loading')}</p>
      ) : sortedPlans.length === 0 ? (
        <p>{translate(locale, 'ratePlan.empty')}</p>
      ) : (
        <div>
          {sortedPlans.map((plan) => {
            const draft = drafts[plan.id] ?? draftFromPlan(plan);
            return (
              <article key={plan.id} aria-labelledby={`rate-plan-${plan.id}`}>
                <h2 id={`rate-plan-${plan.id}`}>
                  {plan.name} ({plan.code})
                </h2>
                <p>
                  {translate(locale, 'admin.status')}:{' '}
                  <strong>{statusLabel(locale, plan.status)}</strong>
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
                        <input
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
                      <button
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
                      </button>
                    </li>
                  ))}
                </ul>
                {plan.isBasePlan ? (
                  <fieldset>
                    <legend>{translate(locale, 'ratePlan.selectionLegend')}</legend>
                    <label>
                      {translate(locale, 'ratePlan.includedDurationLabel')}
                      <select
                        aria-label={`${translate(locale, 'ratePlan.includedDurationLabel')} ${plan.name}`}
                        disabled={pending}
                        onChange={(event) =>
                          updateDraft(plan.id, {
                            includedDurationMinutes: Number(event.target.value),
                          })
                        }
                        value={draft.includedDurationMinutes}
                      >
                        {DURATION_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {formatDuration(locale, minutes)}
                          </option>
                        ))}
                      </select>
                    </label>{' '}
                    <label>
                      {translate(locale, 'ratePlan.checkInStart')}
                      <select
                        aria-label={`${translate(locale, 'ratePlan.checkInStart')} ${plan.name}`}
                        disabled={pending}
                        onChange={(event) =>
                          updateDraft(plan.id, {
                            minCheckInMinuteInclusive: event.target.value,
                          })
                        }
                        value={draft.minCheckInMinuteInclusive}
                      >
                        <option value="">{translate(locale, 'ratePlan.anyTime')}</option>
                        {QUARTER_HOUR_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </label>{' '}
                    <label>
                      {translate(locale, 'ratePlan.checkInEnd')}
                      <select
                        aria-label={`${translate(locale, 'ratePlan.checkInEnd')} ${plan.name}`}
                        disabled={pending}
                        onChange={(event) =>
                          updateDraft(plan.id, {
                            maxCheckInMinuteExclusive: event.target.value,
                          })
                        }
                        value={draft.maxCheckInMinuteExclusive}
                      >
                        <option value="">{translate(locale, 'ratePlan.anyTime')}</option>
                        {QUARTER_HOUR_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </label>{' '}
                    <label>
                      {translate(locale, 'ratePlan.minimumDuration')}
                      <select
                        aria-label={`${translate(locale, 'ratePlan.minimumDuration')} ${plan.name}`}
                        disabled={pending}
                        onChange={(event) =>
                          updateDraft(plan.id, {
                            minDurationMinutesInclusive: Number(event.target.value),
                          })
                        }
                        value={draft.minDurationMinutesInclusive}
                      >
                        {DURATION_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {formatDuration(locale, minutes)}
                          </option>
                        ))}
                      </select>
                    </label>{' '}
                    <label>
                      {translate(locale, 'ratePlan.maximumDuration')}
                      <select
                        aria-label={`${translate(locale, 'ratePlan.maximumDuration')} ${plan.name}`}
                        disabled={pending}
                        onChange={(event) =>
                          updateDraft(plan.id, {
                            maxDurationMinutesInclusive: Number(event.target.value),
                          })
                        }
                        value={draft.maxDurationMinutesInclusive}
                      >
                        {DURATION_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {formatDuration(locale, minutes)}
                          </option>
                        ))}
                      </select>
                    </label>{' '}
                    <label>
                      {translate(locale, 'ratePlan.priority')}
                      <select
                        aria-label={`${translate(locale, 'ratePlan.priority')} ${plan.name}`}
                        disabled={pending}
                        onChange={(event) =>
                          updateDraft(plan.id, { priority: Number(event.target.value) })
                        }
                        value={draft.priority}
                      >
                        {PRIORITY_OPTIONS.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </label>{' '}
                    <button
                      disabled={pending || !draft.isDirty}
                      onClick={() => void saveSelectionRule(plan)}
                      type="button"
                    >
                      {translate(locale, 'ratePlan.saveSelection')}
                    </button>
                    {draft.isDirty ? (
                      <span aria-live="polite">
                        {' '}
                        · {translate(locale, 'ratePlan.unsavedChanges')}
                      </span>
                    ) : null}
                  </fieldset>
                ) : null}
                <button
                  disabled={pending || plan.status === 'ACTIVE'}
                  onClick={() => void changeStatus(plan, true)}
                  type="button"
                >
                  {translate(locale, 'ratePlan.activate')}
                </button>{' '}
                <button
                  disabled={pending || plan.status === 'INACTIVE'}
                  onClick={() => void changeStatus(plan, false)}
                  type="button"
                >
                  {translate(locale, 'ratePlan.deactivate')}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
