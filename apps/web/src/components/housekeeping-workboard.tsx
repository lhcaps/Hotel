'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AdminApiError, adminApi, type HousekeepingTaskList } from '../lib/admin-api';
import { compareRoomDisplayOrder } from '../lib/admin-natural-sort';
import { translate, type MessageKey } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AdminDataTable, AdminStatusBadge, AdminDetailSheet } from './admin/admin-ui';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import type { AdminMe, HousekeepingTaskRecord } from '@room/contracts';

type TaskStatus = 'SCHEDULED' | 'DUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type TaskType = 'ARRIVAL_PREP' | 'TURNOVER';
type HousekeepingCondition = 'CLEAN' | 'DIRTY' | 'CLEANING';

const taskStatusLabels = {
  SCHEDULED: 'admin.housekeepingScheduled',
  DUE: 'admin.housekeepingDue',
  IN_PROGRESS: 'admin.housekeepingInProgress',
  DONE: 'admin.housekeepingDone',
  CANCELLED: 'admin.cancelled',
} as const satisfies Record<TaskStatus, MessageKey>;

const taskTypeLabels = {
  ARRIVAL_PREP: 'admin.taskArrivalPrep',
  TURNOVER: 'admin.taskTurnover',
} as const satisfies Record<TaskType, MessageKey>;

const housekeepingConditionLabels = {
  CLEAN: 'admin.housekeepingClean',
  DIRTY: 'admin.housekeepingDirty',
  CLEANING: 'admin.housekeepingCleaning',
} as const satisfies Record<HousekeepingCondition, MessageKey>;

function formatTime(value: string, locale: string): string {
  return new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function canManageTask(permissions: readonly string[]): boolean {
  return permissions.includes('housekeeping.task.manage');
}

function canExecuteTask(permissions: readonly string[]): boolean {
  return permissions.includes('housekeeping.task.update');
}

export function HousekeepingWorkboard() {
  const locale = useLocale();
  const [tasks, setTasks] = useState<readonly HousekeepingTaskRecord[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [me, setMe] = useState<AdminMe>();
  const [assignees, setAssignees] = useState<
    Awaited<ReturnType<typeof adminApi.listHousekeepingAssignees>>
  >([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [stale, setStale] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TaskType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [reopenTask, setReopenTask] = useState<HousekeepingTaskRecord | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [cancelTask, setCancelTask] = useState<HousekeepingTaskRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const refresh = useCallback(() => {
    setError(undefined);
    setStale(false);
    return Promise.all([adminApi.listHousekeepingTasks(), adminApi.me()])
      .then(async ([list, actor]: [HousekeepingTaskList, AdminMe]) => {
        setTasks(list?.items ?? []);
        setTasksLoaded(true);
        setMe(actor);
        if (canManageTask(actor.permissions)) {
          setAssignees(await adminApi.listHousekeepingAssignees());
        } else {
          setAssignees([]);
        }
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof AdminApiError
            ? cause.message
            : translate(locale, 'admin.loadErrorHeading'),
        );
      });
  }, [locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (tasks.length === 0) return;
    const timer = window.setTimeout(() => setStale(true), 60_000);
    return () => window.clearTimeout(timer);
  }, [tasks]);

  const isStaffActor = me?.profileCode === 'HOUSEKEEPING_STAFF';
  const canManage = me !== undefined && canManageTask(me.permissions);
  const canExecute = me !== undefined && canExecuteTask(me.permissions);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return (tasks ?? [])
      .filter((task) => statusFilter === 'ALL' || task.status === statusFilter)
      .filter((task) => typeFilter === 'ALL' || task.type === typeFilter)
      .filter((task) => {
        if (!isStaffActor) return true;
        return task.assigneeId === me?.id;
      })
      .filter((task) => {
        if (normalizedQuery.length === 0) return true;
        return [task.roomNumber, task.physicalRoomCode, task.roomConcept, task.roomTier].some(
          (value) => value.toLocaleLowerCase(locale).includes(normalizedQuery),
        );
      })
      .sort(
        (left, right) =>
          compareRoomDisplayOrder(left.roomNumber, right.roomNumber) ||
          left.dueAt.localeCompare(right.dueAt),
      );
  }, [tasks, typeFilter, statusFilter, isStaffActor, me?.id, locale, query]);

  const getStatusTone = (status: TaskStatus): 'success' | 'warning' | 'neutral' => {
    if (status === 'DONE') return 'success';
    if (status === 'IN_PROGRESS') return 'warning';
    return 'neutral';
  };

  const getConditionTone = (condition: HousekeepingCondition): 'success' | 'warning' | 'danger' => {
    if (condition === 'CLEAN') return 'success';
    if (condition === 'DIRTY') return 'danger';
    return 'warning';
  };

  const clearActionError = useCallback((taskId: string) => {
    setActionError((current) => ({ ...current, [taskId]: '' }));
  }, []);

  const setBusy = useCallback((taskId: string, value: boolean) => {
    setPending((current) => ({ ...current, [taskId]: value }));
  }, []);

  const handleTaskAction = useCallback(
    async (task: HousekeepingTaskRecord, action: 'start' | 'complete') => {
      setBusy(task.taskId, true);
      clearActionError(task.taskId);
      try {
        if (action === 'start') {
          await adminApi.startHousekeepingTask(task.taskId, { expectedVersion: task.version });
        } else {
          await adminApi.completeHousekeepingTask(task.taskId, { expectedVersion: task.version });
        }
        await refresh();
      } catch (cause: unknown) {
        setActionError((current) => ({
          ...current,
          [task.taskId]:
            cause instanceof AdminApiError ? cause.message : translate(locale, 'admin.actionError'),
        }));
      } finally {
        setBusy(task.taskId, false);
      }
    },
    [locale, refresh, clearActionError, setBusy],
  );

  const handleAssignment = useCallback(
    async (task: HousekeepingTaskRecord) => {
      const draft = assignmentDrafts[task.taskId];
      const targetId = draft ?? task.assigneeId ?? '';
      if (targetId === '') return;
      setBusy(task.taskId, true);
      clearActionError(task.taskId);
      try {
        await adminApi.assignHousekeepingTask(task.taskId, {
          assigneeId: targetId,
          expectedVersion: task.version,
        });
        await refresh();
      } catch (cause: unknown) {
        setActionError((current) => ({
          ...current,
          [task.taskId]:
            cause instanceof AdminApiError ? cause.message : translate(locale, 'admin.actionError'),
        }));
      } finally {
        setBusy(task.taskId, false);
      }
    },
    [assignmentDrafts, locale, refresh, clearActionError, setBusy],
  );

  const handleManagerAction = useCallback(
    async (task: HousekeepingTaskRecord, action: 'verify' | 'reopen' | 'cancel') => {
      if (action === 'verify') {
        setBusy(task.taskId, true);
        clearActionError(task.taskId);
        try {
          await adminApi.verifyHousekeepingTask(task.taskId, { expectedVersion: task.version });
          await refresh();
        } catch (cause: unknown) {
          setActionError((current) => ({
            ...current,
            [task.taskId]:
              cause instanceof AdminApiError
                ? cause.message
                : translate(locale, 'admin.actionError'),
          }));
        } finally {
          setBusy(task.taskId, false);
        }
        return;
      }

      if (action === 'reopen') {
        if (reopenReason.trim() === '') {
          setActionError((current) => ({
            ...current,
            [task.taskId]: translate(locale, 'admin.reasonRequired'),
          }));
          return;
        }
        setBusy(task.taskId, true);
        clearActionError(task.taskId);
        try {
          await adminApi.reopenHousekeepingTask(task.taskId, {
            expectedVersion: task.version,
            reason: reopenReason.trim(),
          });
          setReopenTask(null);
          setReopenReason('');
          await refresh();
        } catch (cause: unknown) {
          setActionError((current) => ({
            ...current,
            [task.taskId]:
              cause instanceof AdminApiError
                ? cause.message
                : translate(locale, 'admin.actionError'),
          }));
        } finally {
          setBusy(task.taskId, false);
        }
        return;
      }

      if (cancelReason.trim() === '') {
        setActionError((current) => ({
          ...current,
          [task.taskId]: translate(locale, 'admin.reasonRequired'),
        }));
        return;
      }
      setBusy(task.taskId, true);
      clearActionError(task.taskId);
      try {
        await adminApi.cancelHousekeepingTask(task.taskId, {
          expectedVersion: task.version,
          reason: cancelReason.trim(),
        });
        setCancelTask(null);
        setCancelReason('');
        await refresh();
      } catch (cause: unknown) {
        setActionError((current) => ({
          ...current,
          [task.taskId]:
            cause instanceof AdminApiError ? cause.message : translate(locale, 'admin.actionError'),
        }));
      } finally {
        setBusy(task.taskId, false);
      }
    },
    [cancelReason, clearActionError, locale, refresh, reopenReason, setBusy],
  );

  const actionableForManager = (task: HousekeepingTaskRecord): boolean =>
    canManage &&
    (task.status === 'SCHEDULED' || task.status === 'DUE') &&
    (task.assigneeId === null ||
      assignmentDrafts[task.taskId] === undefined ||
      assignmentDrafts[task.taskId] !== task.assigneeId);

  const executableForStaff = (task: HousekeepingTaskRecord): boolean =>
    isStaffActor &&
    canExecute &&
    task.assigneeId === me?.id &&
    (task.status === 'SCHEDULED' || task.status === 'DUE' || task.status === 'IN_PROGRESS');

  const renderActionCell = (task: HousekeepingTaskRecord) => {
    const actionErr = actionError[task.taskId];

    if (isStaffActor && !executableForStaff(task)) {
      return (
        <div className="admin-workboard-cell-stack">
          <span className="admin-muted">{translate(locale, 'admin.noAction')}</span>
        </div>
      );
    }

    if (!canManage && !(isStaffActor && executableForStaff(task))) {
      return (
        <div className="admin-workboard-cell-stack">
          <span className="admin-muted">{translate(locale, 'admin.noAction')}</span>
        </div>
      );
    }

    if (!canManage && isStaffActor && executableForStaff(task)) {
      const canStart = canExecute && (task.status === 'SCHEDULED' || task.status === 'DUE');
      const canComplete = canExecute && task.status === 'IN_PROGRESS';
      return (
        <div className="admin-workboard-cell-stack">
          <div className="admin-workboard-cell-stack__row">
            {canStart ? (
              <Button
                size="sm"
                onClick={() => void handleTaskAction(task, 'start')}
                disabled={pending[task.taskId] === true}
              >
                {translate(locale, 'admin.startTask')}
              </Button>
            ) : null}
            {canComplete ? (
              <Button
                size="sm"
                onClick={() => void handleTaskAction(task, 'complete')}
                disabled={pending[task.taskId] === true}
              >
                {translate(locale, 'admin.completeTask')}
              </Button>
            ) : null}
          </div>
          {actionErr !== undefined && actionErr !== '' ? (
            <Alert variant="destructive" className="admin-workboard-error">
              <AlertTitle>{translate(locale, 'admin.actionError')}</AlertTitle>
              <AlertDescription>{actionErr}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      );
    }

    const canAssign = canManage && actionableForManager(task);
    const hasAssignee = task.assigneeId !== null && assignmentDrafts[task.taskId] === undefined;
    const hasDraft = assignmentDrafts[task.taskId] !== undefined;
    const canVerify = canManage && task.status === 'DONE' && task.verifiedAt === null;
    const canReopen = canManage && task.status === 'DONE';
    const canCancel = canManage && (task.status === 'SCHEDULED' || task.status === 'DUE');
    const showAssignStaffEmpty = canManage && assignees.length === 0 && task.assigneeId === null;

    if (showAssignStaffEmpty) {
      return (
        <div className="admin-workboard-cell-stack">
          <p className="admin-workboard-empty-assignees">
            {translate(locale, 'admin.noHousekeepingStaff')}
          </p>
          <p className="admin-muted">{translate(locale, 'admin.noHousekeepingStaffHelp')}</p>
          <Link className="admin-link" href="/admin/accounts">
            {translate(locale, 'admin.manageAccounts')}
          </Link>
          {actionErr !== undefined && actionErr !== '' ? (
            <Alert variant="destructive" className="admin-workboard-error">
              <AlertTitle>{translate(locale, 'admin.actionError')}</AlertTitle>
              <AlertDescription>{actionErr}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      );
    }

    return (
      <div className="admin-workboard-cell-stack">
        <div className="admin-workboard-cell-stack__row">
          {canAssign ? (
            <>
              <Select
                value={assignmentDrafts[task.taskId] ?? task.assigneeId ?? ''}
                onValueChange={(value) => {
                  if (value !== null) {
                    setAssignmentDrafts((current) => ({
                      ...current,
                      [task.taskId]: value,
                    }));
                  }
                }}
              >
                <SelectTrigger
                  aria-label={translate(locale, 'admin.assignee')}
                  className="admin-workboard-assignee-trigger"
                >
                  <SelectValue placeholder={translate(locale, 'admin.assigneeSelectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      {assignee.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleAssignment(task)}
                disabled={pending[task.taskId] === true || (hasAssignee && !hasDraft)}
              >
                {hasAssignee && !hasDraft
                  ? translate(locale, 'admin.reassignTask')
                  : translate(locale, 'admin.assignTask')}
              </Button>
            </>
          ) : null}
        </div>
        {canManage ? (
          <div className="admin-workboard-cell-stack__row">
            {canVerify ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleManagerAction(task, 'verify')}
                disabled={pending[task.taskId] === true}
              >
                {translate(locale, 'admin.verifyTask')}
              </Button>
            ) : null}
            {canReopen ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReopenTask(task);
                  setReopenReason('');
                }}
                disabled={pending[task.taskId] === true}
              >
                {translate(locale, 'admin.reopenTask')}
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCancelTask(task);
                  setCancelReason('');
                }}
                disabled={pending[task.taskId] === true}
              >
                {translate(locale, 'admin.cancelTask')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {actionErr !== undefined && actionErr !== '' ? (
          <Alert variant="destructive" className="admin-workboard-error">
            <AlertTitle>{translate(locale, 'admin.actionError')}</AlertTitle>
            <AlertDescription>{actionErr}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  };

  return (
    <section className="housekeeping-workboard" aria-labelledby="housekeeping-heading">
      <div className="admin-surface">
        <div className="admin-surface__header">
          <div className="admin-page-heading admin-page-heading--compact">
            <div>
              <p className="admin-eyebrow">{translate(locale, 'admin.housekeeping')}</p>
              <h2 id="housekeeping-heading">{translate(locale, 'admin.housekeepingTasks')}</h2>
              <p className="admin-supporting-text">
                {translate(locale, 'admin.housekeepingTasksHelp')}
              </p>
            </div>
            <div className="admin-live-state" aria-live="polite">
              {!tasksLoaded
                ? translate(locale, 'admin.roomBoardLoading')
                : `${translate(locale, 'admin.activeTasksSummary', { count: visibleTasks.length })}${stale ? ` · ${translate(locale, 'admin.roomBoardStale')}` : ''}`}
            </div>
          </div>
        </div>
        <div className="admin-surface__content">
          <div className="admin-filter-toolbar">
            <div className="admin-filter-toolbar__controls">
              <label>
                {translate(locale, 'admin.taskType')}
                <Select
                  value={typeFilter}
                  onValueChange={(value) => {
                    if (value !== null) setTypeFilter(value as TaskType | 'ALL');
                  }}
                >
                  <SelectTrigger aria-label={translate(locale, 'admin.taskType')}>
                    <SelectValue>
                      {typeFilter === 'ALL'
                        ? translate(locale, 'admin.all')
                        : translate(locale, taskTypeLabels[typeFilter])}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
                    <SelectItem value="ARRIVAL_PREP">
                      {translate(locale, taskTypeLabels.ARRIVAL_PREP)}
                    </SelectItem>
                    <SelectItem value="TURNOVER">
                      {translate(locale, taskTypeLabels.TURNOVER)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                {translate(locale, 'admin.taskStatus')}
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    if (value !== null) setStatusFilter(value as TaskStatus | 'ALL');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {statusFilter === 'ALL'
                        ? translate(locale, 'admin.all')
                        : translate(locale, taskStatusLabels[statusFilter])}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{translate(locale, 'admin.all')}</SelectItem>
                    <SelectItem value="SCHEDULED">
                      {translate(locale, taskStatusLabels.SCHEDULED)}
                    </SelectItem>
                    <SelectItem value="DUE">{translate(locale, taskStatusLabels.DUE)}</SelectItem>
                    <SelectItem value="IN_PROGRESS">
                      {translate(locale, taskStatusLabels.IN_PROGRESS)}
                    </SelectItem>
                    <SelectItem value="DONE">{translate(locale, taskStatusLabels.DONE)}</SelectItem>
                    <SelectItem value="CANCELLED">
                      {translate(locale, taskStatusLabels.CANCELLED)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="admin-filter-toolbar__search">
                {translate(locale, 'admin.roomSearch')}
                <Input
                  placeholder={translate(locale, 'admin.roomSearchPlaceholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <Button onClick={() => void refresh()} type="button" variant="outline">
                {translate(locale, 'admin.refreshBoard')}
              </Button>
            </div>
            <div className="admin-filter-toolbar__summary">
              {translate(locale, 'admin.activeTasksSummary', { count: visibleTasks.length })}
            </div>
          </div>
          {error ? (
            <p className="admin-alert admin-alert--error" role="alert">
              {error}
            </p>
          ) : null}
          {tasks.length > 0 && visibleTasks.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noHousekeepingTasks')}</p>
          ) : null}
          {visibleTasks.length > 0 ? (
            <AdminDataTable variant="operational" className="housekeeping-workboard__table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate(locale, 'admin.room')}</TableHead>
                    <TableHead>{translate(locale, 'admin.roomConcept')}</TableHead>
                    <TableHead>{translate(locale, 'admin.taskType')}</TableHead>
                    <TableHead>{translate(locale, 'admin.housekeepingCondition')}</TableHead>
                    <TableHead>{translate(locale, 'admin.taskStatus')}</TableHead>
                    <TableHead>{translate(locale, 'admin.assignee')}</TableHead>
                    <TableHead>{translate(locale, 'admin.dueTime')}</TableHead>
                    <TableHead>{translate(locale, 'admin.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTasks.map((task) => (
                    <TableRow
                      key={task.taskId}
                      data-task-id={task.taskId}
                      data-task-type={task.type}
                      data-testid={`task-row-${task.taskId}`}
                    >
                      <TableCell data-label={translate(locale, 'admin.room')}>
                        <div className="admin-room-label">
                          <span className="admin-room-label__number">
                            {translate(locale, 'admin.roomNumber', {
                              number: task.roomNumber,
                            })}
                          </span>
                          <span className="admin-muted admin-room-label__physical">
                            {task.physicalRoomCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.roomConcept')}>
                        <div className="admin-room-label admin-room-label--concept">
                          <span className="admin-room-label__concept">{task.roomConcept}</span>
                          <span className="admin-muted admin-room-label__tier">
                            {task.roomTier}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.taskType')}>
                        {translate(locale, taskTypeLabels[task.type])}
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.housekeepingCondition')}>
                        <AdminStatusBadge tone={getConditionTone(task.housekeepingStatus)}>
                          {translate(locale, housekeepingConditionLabels[task.housekeepingStatus])}
                        </AdminStatusBadge>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.taskStatus')}>
                        <AdminStatusBadge tone={getStatusTone(task.status)}>
                          {translate(locale, taskStatusLabels[task.status])}
                        </AdminStatusBadge>
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.assignee')}>
                        {task.assigneeName !== null
                          ? task.assigneeName
                          : translate(locale, 'admin.unassigned')}
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.dueTime')}>
                        {formatTime(task.dueAt, locale)}
                      </TableCell>
                      <TableCell data-label={translate(locale, 'admin.action')}>
                        {renderActionCell(task)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminDataTable>
          ) : null}
        </div>
        <AdminDetailSheet
          open={reopenTask !== null}
          onOpenChange={(open) => {
            if (!open) {
              setReopenTask(null);
              setReopenReason('');
            }
          }}
          title={translate(locale, 'admin.reopenTask')}
          description={translate(locale, 'admin.reopenTaskReason')}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReopenTask(null);
                  setReopenReason('');
                }}
              >
                {translate(locale, 'admin.cancel')}
              </Button>
              <Button
                type="button"
                disabled={reopenTask === null || pending[reopenTask.taskId] === true}
                onClick={() => {
                  if (reopenTask === null) return;
                  void handleManagerAction(reopenTask, 'reopen');
                }}
              >
                {translate(locale, 'admin.apply')}
              </Button>
            </>
          }
        >
          <label className="admin-field-stack">
            <span>{translate(locale, 'admin.reopenTaskReason')}</span>
            <Textarea
              rows={5}
              required
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              placeholder={translate(locale, 'admin.reasonPlaceholder')}
              aria-invalid={reopenTask !== null && reopenReason.trim() === '' ? 'true' : undefined}
            />
          </label>
        </AdminDetailSheet>
        <AdminDetailSheet
          open={cancelTask !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCancelTask(null);
              setCancelReason('');
            }
          }}
          title={translate(locale, 'admin.cancelTask')}
          description={translate(locale, 'admin.cancelTaskReason')}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCancelTask(null);
                  setCancelReason('');
                }}
              >
                {translate(locale, 'admin.cancel')}
              </Button>
              <Button
                type="button"
                disabled={cancelTask === null || pending[cancelTask.taskId] === true}
                onClick={() => {
                  if (cancelTask === null) return;
                  void handleManagerAction(cancelTask, 'cancel');
                }}
              >
                {translate(locale, 'admin.apply')}
              </Button>
            </>
          }
        >
          <label className="admin-field-stack">
            <span>{translate(locale, 'admin.cancelTaskReason')}</span>
            <Textarea
              rows={5}
              required
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder={translate(locale, 'admin.reasonPlaceholder')}
              aria-invalid={cancelTask !== null && cancelReason.trim() === '' ? 'true' : undefined}
            />
          </label>
        </AdminDetailSheet>
      </div>
    </section>
  );
}
