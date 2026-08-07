'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AdminApiError,
  adminApi,
  type AdminPricingPolicyAggregate,
  type AdminPricingPolicyHeader,
  type AdminPricingPolicyPreview,
  type PricingPolicyStatus,
} from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import {
  AdminDataTable,
  AdminEmptyState,
  AdminLoadingState,
  AdminPageHeader,
} from './admin/admin-ui';

interface BootstrapDraft {
  internalName: string;
  effectiveFrom: string;
  effectiveUntil: string;
  overnightWindow: '21-09' | '22-10';
  nightPlanCode: string;
}

interface CreateDraftForm {
  internalName: string;
  effectiveFrom: string;
  effectiveUntil: string;
}

interface AggregateEditor {
  internalName: string;
  effectiveFrom: string;
  effectiveUntil: string;
  maximumComponentLines: string;
  changeNote: string;
  components: readonly Record<string, unknown>[];
  prices: readonly Record<string, unknown>[];
  edges: readonly Record<string, unknown>[];
}

const initialBootstrap: BootstrapDraft = {
  internalName: 'Operations V3 B0 multi-night',
  effectiveFrom: '',
  effectiveUntil: '',
  overnightWindow: '21-09',
  nightPlanCode: 'NIGHT_COMBO',
};

const initialCreateDraft: CreateDraftForm = {
  internalName: '',
  effectiveFrom: '',
  effectiveUntil: '',
};

function inputDate(instant: string | null | undefined): string {
  if (instant === null || instant === undefined) return '';
  return instant.slice(0, 16);
}

function instantFromInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid date and time are required.');
  return date.toISOString();
}

function editorFromAggregate(aggregate: AdminPricingPolicyAggregate): AggregateEditor {
  return {
    internalName: aggregate.root.internalName,
    effectiveFrom: inputDate(aggregate.root.effectiveFrom),
    effectiveUntil: inputDate(aggregate.root.effectiveUntil),
    maximumComponentLines: String(aggregate.root.maximumComponentLines),
    changeNote: aggregate.root.changeNote ?? '',
    components: aggregate.components.map((component) => ({ ...component })),
    prices: aggregate.prices.map((price) => ({ ...price })),
    edges: aggregate.edges.map((edge) => ({ ...edge })),
  };
}

function actionError(cause: unknown, fallback: string): string {
  if (cause instanceof AdminApiError) return cause.problem.detail;
  if (cause instanceof Error) return cause.message;
  return fallback;
}

function statusLabel(locale: ReturnType<typeof useLocale>, status: PricingPolicyStatus): string {
  return translate(locale, `pricingPolicy.status${status}` as never);
}

function basisLabel(
  locale: ReturnType<typeof useLocale>,
  basis: AdminPricingPolicyHeader['applicabilityBasis'],
): string {
  return basis === 'STAY_START'
    ? translate(locale, 'pricingPolicy.basisStayStart')
    : translate(locale, 'pricingPolicy.basisQuoteInstant');
}

const numericFields: readonly (readonly [string, string])[] = [
  ['fixedDurationMinutes', 'pricingPolicy.fixedDurationMinutes'],
  ['localStartMinuteInclusive', 'pricingPolicy.localStartMinute'],
  ['localEndMinuteExclusive', 'pricingPolicy.localEndMinute'],
  ['localEndDayOffset', 'pricingPolicy.localEndDayOffset'],
  ['boundaryMinDurationMinutes', 'pricingPolicy.boundaryMin'],
  ['boundaryMaxDurationMinutes', 'pricingPolicy.boundaryMax'],
  ['billingUnitMinutes', 'pricingPolicy.billingUnit'],
  ['minimumBillingUnits', 'pricingPolicy.minimumUnits'],
  ['maximumBillingUnits', 'pricingPolicy.maximumUnits'],
  ['maximumOccurrencesPerCandidate', 'pricingPolicy.maximumOccurrences'],
  ['conditionComplexityRank', 'pricingPolicy.conditionRank'],
  ['tieBreakRank', 'pricingPolicy.tieBreakRank'],
];

function recordString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function recordNumber(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'number' ? String(value) : '';
}

function setRecordValue(
  record: Record<string, unknown>,
  key: string,
  value: string,
  numeric = false,
): Record<string, unknown> {
  if (!numeric) return { ...record, [key]: value };
  return { ...record, [key]: value.trim() === '' ? null : Number(value) };
}

function componentLabel(locale: ReturnType<typeof useLocale>, code: string): string {
  const labels: Record<
    string,
    | 'pricingPolicy.componentLeading'
    | 'pricingPolicy.componentContinuation'
    | 'pricingPolicy.componentFinalNight'
    | 'pricingPolicy.componentTrailing'
  > = {
    B0_LEADING: 'pricingPolicy.componentLeading',
    B0_CONTINUATION: 'pricingPolicy.componentContinuation',
    B0_FINAL_NIGHT: 'pricingPolicy.componentFinalNight',
    B0_TRAILING: 'pricingPolicy.componentTrailing',
  };
  return translate(locale, labels[code] ?? 'pricingPolicy.componentUnknown');
}

function coverageLabel(locale: ReturnType<typeof useLocale>, value: string): string {
  if (value === 'FIXED_ELAPSED') return translate(locale, 'pricingPolicy.coverageFixedElapsed');
  if (value === 'LOCAL_CLOCK_WINDOW') return translate(locale, 'pricingPolicy.coverageLocalClock');
  if (value === 'REQUEST_BOUNDARY')
    return translate(locale, 'pricingPolicy.coverageRequestBoundary');
  return translate(locale, 'pricingPolicy.incomplete');
}

function billingLabel(locale: ReturnType<typeof useLocale>, value: string): string {
  if (value === 'FIXED_OCCURRENCE')
    return translate(locale, 'pricingPolicy.billingFixedOccurrence');
  if (value === 'STARTED_UNIT') return translate(locale, 'pricingPolicy.billingStartedUnit');
  return translate(locale, 'pricingPolicy.incomplete');
}

function objectKeyCount(value: unknown): number {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;
}

export function PricingPolicyManager() {
  const locale = useLocale();
  const [releases, setReleases] = useState<readonly AdminPricingPolicyHeader[]>();
  const [selectedId, setSelectedId] = useState<string>();
  const [aggregate, setAggregate] = useState<AdminPricingPolicyAggregate>();
  const [editor, setEditor] = useState<AggregateEditor>();
  const [bootstrap, setBootstrap] = useState<BootstrapDraft>(initialBootstrap);
  const [createDraft, setCreateDraft] = useState<CreateDraftForm>(initialCreateDraft);
  const [preview, setPreview] = useState<AdminPricingPolicyPreview>();
  const [cancelReason, setCancelReason] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [cutover, setCutover] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.listPricingPolicies();
      setReleases(result.releases);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.loadError')));
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => releases?.find((release) => release.id === selectedId),
    [releases, selectedId],
  );

  async function openRelease(id: string) {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await adminApi.getPricingPolicy(id);
      setSelectedId(id);
      setAggregate(result);
      setEditor(editorFromAggregate(result));
      setPreview(undefined);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.detailError')));
    } finally {
      setPending(false);
    }
  }

  async function refresh(id = selectedId) {
    await load();
    if (id !== undefined) await openRelease(id);
  }

  async function runBootstrap(dryRun: boolean) {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await adminApi.bootstrapPricingPolicy({
        internalName: bootstrap.internalName,
        effectiveFrom: instantFromInput(bootstrap.effectiveFrom),
        effectiveUntil:
          bootstrap.effectiveUntil === '' ? null : instantFromInput(bootstrap.effectiveUntil),
        overnightWindow: bootstrap.overnightWindow,
        nightPlanCode: bootstrap.nightPlanCode.trim().toUpperCase(),
        extraHourPlanCode: 'EXTRA_HOUR',
        idempotencyKey: `b0-admin-${Date.now()}`,
        dryRun,
      });
      setPreview(result);
      setMessage(
        result.publicationReady
          ? translate(locale, 'pricingPolicy.previewReady')
          : translate(locale, 'pricingPolicy.previewInvalid'),
      );
      if (!dryRun && result.created) await refresh(result.policyId);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.bootstrapError')));
    } finally {
      setPending(false);
    }
  }

  async function runCreateDraft() {
    if (createDraft.internalName.trim() === '' || createDraft.effectiveFrom === '') return;
    setPending(true);
    setMessage(undefined);
    try {
      const result = await adminApi.createPricingPolicyDraft({
        internalName: createDraft.internalName.trim(),
        effectiveFrom: instantFromInput(createDraft.effectiveFrom),
        effectiveUntil:
          createDraft.effectiveUntil === '' ? null : instantFromInput(createDraft.effectiveUntil),
      });
      setCreateDraft(initialCreateDraft);
      setMessage(translate(locale, 'pricingPolicy.saved'));
      await refresh(result.policyId);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.createError')));
    } finally {
      setPending(false);
    }
  }

  async function saveDraft() {
    if (selectedId === undefined || aggregate === undefined || editor === undefined) return;
    setPending(true);
    setMessage(undefined);
    try {
      await adminApi.updatePricingPolicyDraft(selectedId, {
        internalName: editor.internalName,
        effectiveFrom: instantFromInput(editor.effectiveFrom),
        effectiveUntil:
          editor.effectiveUntil === '' ? null : instantFromInput(editor.effectiveUntil),
        maximumComponentLines: Number(editor.maximumComponentLines),
        changeNote: editor.changeNote === '' ? null : editor.changeNote,
        components: editor.components,
        prices: editor.prices,
        edges: editor.edges,
        expectedUpdatedAt: aggregate.root.updatedAt,
      });
      setMessage(translate(locale, 'pricingPolicy.saved'));
      await refresh(selectedId);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.saveError')));
    } finally {
      setPending(false);
    }
  }

  async function runPreview() {
    if (selectedId === undefined) return;
    setPending(true);
    setMessage(undefined);
    try {
      const result = await adminApi.previewPricingPolicy(selectedId);
      setPreview(result);
      setMessage(
        result.publicationReady
          ? translate(locale, 'pricingPolicy.previewReady')
          : translate(locale, 'pricingPolicy.previewInvalid'),
      );
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.previewError')));
    } finally {
      setPending(false);
    }
  }

  async function publish() {
    if (selectedId === undefined) return;
    if (!window.confirm(translate(locale, 'pricingPolicy.confirmPublish'))) return;
    setPending(true);
    setMessage(undefined);
    try {
      await adminApi.publishPricingPolicy(selectedId, `b0-publish-${Date.now()}`);
      setMessage(translate(locale, 'pricingPolicy.published'));
      await refresh(selectedId);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.publishError')));
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    if (selectedId === undefined || cancelReason.trim() === '') return;
    setPending(true);
    setMessage(undefined);
    try {
      await adminApi.cancelPricingPolicy(selectedId, cancelReason);
      setCancelReason('');
      setMessage(translate(locale, 'pricingPolicy.cancelled'));
      await refresh(selectedId);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.cancelError')));
    } finally {
      setPending(false);
    }
  }

  async function supersede() {
    if (selectedId === undefined || successorId.trim() === '' || cutover === '') return;
    if (!window.confirm(translate(locale, 'pricingPolicy.confirmSupersede'))) return;
    setPending(true);
    setMessage(undefined);
    try {
      await adminApi.supersedePricingPolicy(selectedId, {
        successorId: successorId.trim(),
        cutover: instantFromInput(cutover),
        idempotencyKey: `b0-supersede-${Date.now()}`,
      });
      setMessage(translate(locale, 'pricingPolicy.superseded'));
      await refresh(selectedId);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.supersedeError')));
    } finally {
      setPending(false);
    }
  }

  async function retire() {
    if (selectedId === undefined) return;
    if (!window.confirm(translate(locale, 'pricingPolicy.confirmRetire'))) return;
    setPending(true);
    setMessage(undefined);
    try {
      await adminApi.retirePricingPolicy(selectedId);
      setMessage(translate(locale, 'pricingPolicy.retired'));
      await refresh(selectedId);
    } catch (cause) {
      setMessage(actionError(cause, translate(locale, 'pricingPolicy.retireError')));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'pricingPolicy.heading')}
        description={translate(locale, 'pricingPolicy.help')}
      />
      {message ? <p role="alert">{message}</p> : null}
      <AdminDataTable>
        <table>
          <thead>
            <tr>
              <th>{translate(locale, 'pricingPolicy.property')}</th>
              <th>{translate(locale, 'pricingPolicy.version')}</th>
              <th>{translate(locale, 'pricingPolicy.name')}</th>
              <th>{translate(locale, 'pricingPolicy.status')}</th>
              <th>{translate(locale, 'pricingPolicy.basis')}</th>
              <th>{translate(locale, 'pricingPolicy.effectiveFrom')}</th>
              <th>{translate(locale, 'pricingPolicy.effectiveUntil')}</th>
              <th>{translate(locale, 'pricingPolicy.createdAt')}</th>
              <th>{translate(locale, 'pricingPolicy.updatedAt')}</th>
              <th>{translate(locale, 'pricingPolicy.completeness')}</th>
              <th>{translate(locale, 'pricingPolicy.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(releases ?? []).map((release) => (
              <tr key={release.id}>
                <td>{release.propertyId}</td>
                <td>{release.versionNumber}</td>
                <td>{release.internalName}</td>
                <td>{statusLabel(locale, release.status)}</td>
                <td>{basisLabel(locale, release.applicabilityBasis)}</td>
                <td>{new Date(release.effectiveFrom).toLocaleString()}</td>
                <td>
                  {release.effectiveUntil === null
                    ? translate(locale, 'pricingPolicy.openEnded')
                    : new Date(release.effectiveUntil).toLocaleString()}
                </td>
                <td>{new Date(release.createdAt).toLocaleString()}</td>
                <td>{new Date(release.updatedAt).toLocaleString()}</td>
                <td>
                  {release.componentCount ?? 0} / {release.priceCount ?? 0}{' '}
                  {release.priceComplete
                    ? translate(locale, 'pricingPolicy.complete')
                    : translate(locale, 'pricingPolicy.incomplete')}
                </td>
                <td>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void openRelease(release.id)}
                  >
                    {translate(locale, 'pricingPolicy.open')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminDataTable>
      {releases !== undefined && releases.length === 0 ? (
        <AdminEmptyState
          title={translate(locale, 'pricingPolicy.empty')}
          description={translate(locale, 'pricingPolicy.emptyHelp')}
        />
      ) : null}
      {releases === undefined ? (
        <AdminLoadingState label={translate(locale, 'pricingPolicy.loading')} />
      ) : null}

      <section className="admin-form-section">
        <h2>{translate(locale, 'pricingPolicy.createHeading')}</h2>
        <p>{translate(locale, 'pricingPolicy.createHelp')}</p>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pricing-policy-create-name">
              {translate(locale, 'pricingPolicy.name')}
            </FieldLabel>
            <Input
              id="pricing-policy-create-name"
              value={createDraft.internalName}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, internalName: event.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pricing-policy-create-from">
              {translate(locale, 'pricingPolicy.effectiveFrom')}
            </FieldLabel>
            <Input
              id="pricing-policy-create-from"
              type="datetime-local"
              value={createDraft.effectiveFrom}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, effectiveFrom: event.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pricing-policy-create-until">
              {translate(locale, 'pricingPolicy.effectiveUntil')}
            </FieldLabel>
            <Input
              id="pricing-policy-create-until"
              type="datetime-local"
              value={createDraft.effectiveUntil}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, effectiveUntil: event.target.value }))
              }
            />
          </Field>
        </FieldGroup>
        <Button
          type="button"
          disabled={
            pending || createDraft.internalName.trim() === '' || createDraft.effectiveFrom === ''
          }
          onClick={() => void runCreateDraft()}
        >
          {translate(locale, 'pricingPolicy.create')}
        </Button>
      </section>

      <section className="admin-form-section">
        <h2>{translate(locale, 'pricingPolicy.bootstrapHeading')}</h2>
        <p>{translate(locale, 'pricingPolicy.bootstrapHelp')}</p>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pricing-policy-name">
              {translate(locale, 'pricingPolicy.name')}
            </FieldLabel>
            <Input
              id="pricing-policy-name"
              value={bootstrap.internalName}
              onChange={(event) =>
                setBootstrap((current) => ({ ...current, internalName: event.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pricing-policy-from">
              {translate(locale, 'pricingPolicy.effectiveFrom')}
            </FieldLabel>
            <Input
              id="pricing-policy-from"
              type="datetime-local"
              value={bootstrap.effectiveFrom}
              onChange={(event) =>
                setBootstrap((current) => ({ ...current, effectiveFrom: event.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pricing-policy-until">
              {translate(locale, 'pricingPolicy.effectiveUntil')}
            </FieldLabel>
            <Input
              id="pricing-policy-until"
              type="datetime-local"
              value={bootstrap.effectiveUntil}
              onChange={(event) =>
                setBootstrap((current) => ({ ...current, effectiveUntil: event.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pricing-policy-night-plan">
              {translate(locale, 'pricingPolicy.nightPlan')}
            </FieldLabel>
            <Input
              id="pricing-policy-night-plan"
              value={bootstrap.nightPlanCode}
              onChange={(event) =>
                setBootstrap((current) => ({ ...current, nightPlanCode: event.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pricing-policy-window">
              {translate(locale, 'pricingPolicy.window')}
            </FieldLabel>
            <select
              id="pricing-policy-window"
              value={bootstrap.overnightWindow}
              onChange={(event) =>
                setBootstrap((current) => ({
                  ...current,
                  overnightWindow: event.target.value === '22-10' ? '22-10' : '21-09',
                }))
              }
            >
              <option value="21-09">21:00–09:00</option>
              <option value="22-10">22:00–10:00</option>
            </select>
          </Field>
        </FieldGroup>
        <div className="admin-responsive-actions">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void runBootstrap(true)}
          >
            {translate(locale, 'pricingPolicy.previewBootstrap')}
          </Button>
          <Button type="button" disabled={pending} onClick={() => void runBootstrap(false)}>
            {translate(locale, 'pricingPolicy.bootstrap')}
          </Button>
        </div>
      </section>

      {selected !== undefined && editor !== undefined ? (
        <section className="admin-form-section">
          <h2>{translate(locale, 'pricingPolicy.editorHeading')}</h2>
          <p>
            {statusLabel(locale, selected.status)} · {selected.timezoneSnapshot} ·{' '}
            {basisLabel(locale, selected.applicabilityBasis)}
          </p>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pricing-policy-edit-name">
                {translate(locale, 'pricingPolicy.name')}
              </FieldLabel>
              <Input
                id="pricing-policy-edit-name"
                value={editor.internalName}
                disabled={selected.status !== 'DRAFT'}
                onChange={(event) =>
                  setEditor(
                    (current) => current && { ...current, internalName: event.target.value },
                  )
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pricing-policy-edit-from">
                {translate(locale, 'pricingPolicy.effectiveFrom')}
              </FieldLabel>
              <Input
                id="pricing-policy-edit-from"
                type="datetime-local"
                value={editor.effectiveFrom}
                disabled={selected.status !== 'DRAFT'}
                onChange={(event) =>
                  setEditor(
                    (current) => current && { ...current, effectiveFrom: event.target.value },
                  )
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pricing-policy-edit-until">
                {translate(locale, 'pricingPolicy.effectiveUntil')}
              </FieldLabel>
              <Input
                id="pricing-policy-edit-until"
                type="datetime-local"
                value={editor.effectiveUntil}
                disabled={selected.status !== 'DRAFT'}
                onChange={(event) =>
                  setEditor(
                    (current) => current && { ...current, effectiveUntil: event.target.value },
                  )
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pricing-policy-lines">
                {translate(locale, 'pricingPolicy.maximumLines')}
              </FieldLabel>
              <Input
                id="pricing-policy-lines"
                type="number"
                min={1}
                max={64}
                value={editor.maximumComponentLines}
                disabled={selected.status !== 'DRAFT'}
                onChange={(event) =>
                  setEditor(
                    (current) =>
                      current && { ...current, maximumComponentLines: event.target.value },
                  )
                }
              />
            </Field>
            <Field>
              <FieldLabel>{translate(locale, 'pricingPolicy.components')}</FieldLabel>
              <div className="admin-stack" data-testid="pricing-policy-components">
                {editor.components.map((component, index) => {
                  const code = recordString(component, 'componentCode');
                  const editable = selected.status === 'DRAFT';
                  return (
                    <article className="admin-card" key={recordString(component, 'id') || code}>
                      <h3>{componentLabel(locale, code)}</h3>
                      <p>
                        {coverageLabel(locale, recordString(component, 'coverageModel'))} ·{' '}
                        {billingLabel(locale, recordString(component, 'billingModel'))}
                      </p>
                      <div className="admin-form-grid">
                        {numericFields.map(([field, label]) => (
                          <Field key={field}>
                            <FieldLabel htmlFor={`pricing-policy-${index}-${field}`}>
                              {translate(locale, label as never)}
                            </FieldLabel>
                            <Input
                              id={`pricing-policy-${index}-${field}`}
                              type="number"
                              value={recordNumber(component, field)}
                              disabled={!editable}
                              onChange={(event) =>
                                setEditor(
                                  (current) =>
                                    current && {
                                      ...current,
                                      components: current.components.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? setRecordValue(item, field, event.target.value, true)
                                          : item,
                                      ),
                                    },
                                )
                              }
                            />
                          </Field>
                        ))}
                      </div>
                      <p>
                        {translate(locale, 'pricingPolicy.restrictions')}:{' '}
                        {objectKeyCount(component.restrictionMetadata)} ·{' '}
                        {translate(locale, 'pricingPolicy.provenance')}:{' '}
                        {objectKeyCount(component.legacyProvenance)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </Field>
            <Field>
              <FieldLabel>{translate(locale, 'pricingPolicy.prices')}</FieldLabel>
              <div className="admin-stack" data-testid="pricing-policy-prices">
                {editor.prices.map((price, index) => {
                  const component = editor.components.find(
                    (item) => recordString(item, 'id') === recordString(price, 'componentId'),
                  );
                  return (
                    <Field key={recordString(price, 'id') || String(index)}>
                      <FieldLabel htmlFor={`pricing-policy-price-${index}`}>
                        {componentLabel(locale, recordString(component ?? {}, 'componentCode'))} ·{' '}
                        {recordString(price, 'priceTierId')}
                      </FieldLabel>
                      <Input
                        id={`pricing-policy-price-${index}`}
                        inputMode="numeric"
                        value={recordString(price, 'amountVnd')}
                        disabled={selected.status !== 'DRAFT'}
                        onChange={(event) =>
                          setEditor(
                            (current) =>
                              current && {
                                ...current,
                                prices: current.prices.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? setRecordValue(item, 'amountVnd', event.target.value)
                                    : item,
                                ),
                              },
                          )
                        }
                      />
                    </Field>
                  );
                })}
              </div>
            </Field>
            <Field>
              <FieldLabel>{translate(locale, 'pricingPolicy.edges')}</FieldLabel>
              <div className="admin-stack" data-testid="pricing-policy-edges">
                {editor.edges.map((edge, index) => (
                  <div className="admin-form-grid" key={recordString(edge, 'id') || String(index)}>
                    <Field>
                      <FieldLabel htmlFor={`pricing-policy-edge-from-${index}`}>
                        {translate(locale, 'pricingPolicy.predecessor')}
                      </FieldLabel>
                      <select
                        id={`pricing-policy-edge-from-${index}`}
                        value={recordString(edge, 'predecessorComponentId')}
                        disabled={selected.status !== 'DRAFT'}
                        onChange={(event) =>
                          setEditor(
                            (current) =>
                              current && {
                                ...current,
                                edges: current.edges.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? setRecordValue(
                                        item,
                                        'predecessorComponentId',
                                        event.target.value,
                                      )
                                    : item,
                                ),
                              },
                          )
                        }
                      >
                        {editor.components.map((component) => (
                          <option
                            key={recordString(component, 'id')}
                            value={recordString(component, 'id')}
                          >
                            {componentLabel(locale, recordString(component, 'componentCode'))}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`pricing-policy-edge-to-${index}`}>
                        {translate(locale, 'pricingPolicy.successorComponent')}
                      </FieldLabel>
                      <select
                        id={`pricing-policy-edge-to-${index}`}
                        value={recordString(edge, 'successorComponentId')}
                        disabled={selected.status !== 'DRAFT'}
                        onChange={(event) =>
                          setEditor(
                            (current) =>
                              current && {
                                ...current,
                                edges: current.edges.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? setRecordValue(
                                        item,
                                        'successorComponentId',
                                        event.target.value,
                                      )
                                    : item,
                                ),
                              },
                          )
                        }
                      >
                        {editor.components.map((component) => (
                          <option
                            key={recordString(component, 'id')}
                            value={recordString(component, 'id')}
                          >
                            {componentLabel(locale, recordString(component, 'componentCode'))}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p>
                      {translate(locale, 'pricingPolicy.restrictions')}:{' '}
                      {objectKeyCount(edge.restrictionMetadata)}
                    </p>
                  </div>
                ))}
              </div>
            </Field>
          </FieldGroup>
          <div className="admin-responsive-actions">
            {selected.status === 'DRAFT' ? (
              <>
                <Button type="button" disabled={pending} onClick={() => void saveDraft()}>
                  {translate(locale, 'pricingPolicy.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void runPreview()}
                >
                  {translate(locale, 'pricingPolicy.preview')}
                </Button>
                <Button type="button" disabled={pending} onClick={() => void publish()}>
                  {translate(locale, 'pricingPolicy.publish')}
                </Button>
              </>
            ) : null}
            {selected.status === 'PUBLISHED' ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void retire()}
              >
                {translate(locale, 'pricingPolicy.retire')}
              </Button>
            ) : null}
          </div>
          {selected.status === 'DRAFT' ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="pricing-policy-cancel-reason">
                  {translate(locale, 'pricingPolicy.cancelReason')}
                </FieldLabel>
                <Input
                  id="pricing-policy-cancel-reason"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                disabled={pending || cancelReason.trim() === ''}
                onClick={() => void cancel()}
              >
                {translate(locale, 'pricingPolicy.cancel')}
              </Button>
            </FieldGroup>
          ) : null}
          {selected.status === 'PUBLISHED' ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="pricing-policy-successor">
                  {translate(locale, 'pricingPolicy.successor')}
                </FieldLabel>
                <Input
                  id="pricing-policy-successor"
                  value={successorId}
                  onChange={(event) => setSuccessorId(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pricing-policy-cutover">
                  {translate(locale, 'pricingPolicy.cutover')}
                </FieldLabel>
                <Input
                  id="pricing-policy-cutover"
                  type="datetime-local"
                  value={cutover}
                  onChange={(event) => setCutover(event.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                disabled={pending || successorId.trim() === '' || cutover === ''}
                onClick={() => void supersede()}
              >
                {translate(locale, 'pricingPolicy.supersede')}
              </Button>
            </FieldGroup>
          ) : null}
        </section>
      ) : null}

      {preview !== undefined ? (
        <section className="admin-form-section" aria-live="polite">
          <h2>{translate(locale, 'pricingPolicy.validationHeading')}</h2>
          <p>
            {preview.publicationReady
              ? translate(locale, 'pricingPolicy.ready')
              : translate(locale, 'pricingPolicy.notReady')}
          </p>
          {[...preview.errors, ...preview.warnings].map((item) => (
            <p
              key={`${item.code}:${item.path}`}
              role={preview.errors.includes(item) ? 'alert' : undefined}
            >
              {item.path} · {item.message}
            </p>
          ))}
        </section>
      ) : null}
    </section>
  );
}
