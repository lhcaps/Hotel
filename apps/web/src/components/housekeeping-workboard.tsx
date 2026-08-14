'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AdminApiError, adminApi, type AdminRoomOperationsResponse } from '../lib/admin-api';
import { compareRoomDisplayOrder } from '../lib/admin-natural-sort';
import { translate, type MessageKey } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AdminDataTable, AdminStatusBadge, AdminDetailSheet } from './admin/admin-ui';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

type TaskStatus = 'SCHEDULED' | 'DUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

const taskStatusLabels = {
  SCHEDULED: 'admin.housekeepingScheduled',
  DUE: 'admin.housekeepingDue',
  IN_PROGRESS: 'admin.housekeepingInProgress',
  DONE: 'admin.housekeepingDone',
  CANCELLED: 'admin.cancelled',
} as const satisfies Record<TaskStatus, MessageKey>;

function localDate(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateRange(value: string): { from: string; to: string } {
  return {
    from: new Date(`${value}T00:00:00`).toISOString(),
    to: new Date(`${value}T23:59:59.999`).toISOString(),
  };
}

function formatTime(value: string, locale: string): string {
  return new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function HousekeepingWorkboard() {
  const locale = useLocale();
  const [date, setDate] = useState(() => localDate(new Date()));
  const [data, setData] = useState<AdminRoomOperationsResponse>();
  const [me, setMe] = useState<Awaited<ReturnType<typeof adminApi.me>>>();
  const [assignees, setAssignees] = useState<
    Awaited<ReturnType<typeof adminApi.listHousekeepingAssignees>>
  >([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [stale, setStale] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [reopenRoomId, setReopenRoomId] = useState<string>();
  const [reopenReason, setReopenReason] = useState('');

  const refresh = useCallback(() => {
    setError(undefined);
    setStale(false);
    return Promise.all([
      adminApi.getRoomOperations({ ...dateRange(date), includeInactive: false }),
      adminApi.me(),
    ])
      .then(async ([operations, actor]) => {
        setData(operations);
        setMe(actor);
        if (actor.permissions.includes('housekeeping.task.manage')) {
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
  }, [date, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => setStale(true), 60_000);
    return () => window.clearTimeout(timer);
  }, [data?.generatedAt]);

  const roomsWithTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return [...(data?.items ?? [])]
      .filter((room) => room.activeHousekeepingTask !== null || room.latestTurnoverTask !== null)
      .filter((room) => {
        const task = room.activeHousekeepingTask ?? room.latestTurnoverTask;
        if (!task) return false;
        return statusFilter === 'ALL' || task.status === statusFilter;
      })
      .filter(
        (room) =>
          normalizedQuery.length === 0 ||
          [room.roomNumber, room.physicalRoomCode, room.roomConcept].some((value) =>
            value.toLocaleLowerCase(locale).includes(normalizedQuery),
          ),
      )
      .sort((left, right) => compareRoomDisplayOrder(left.roomNumber, right.roomNumber));
  }, [data?.items, locale, query, statusFilter]);

  const getStatusTone = (status: TaskStatus): 'success' | 'warning' | 'neutral' => {
    if (status === 'DONE') return 'success';
    if (status === 'IN_PROGRESS') return 'warning';
    return 'neutral';
  };

  const handleTaskAction = useCallback(
    async (
      taskId: string,
      roomId: string,
      action: 'start' | 'complete',
      expectedVersion: number,
    ) => {
      setPending((current) => ({ ...current, [roomId]: true }));
      setActionError((current) => ({ ...current, [roomId]: '' }));
      try {
        const body = { expectedVersion };
        if (action === 'start') await adminApi.startHousekeepingTask(taskId, body);
        else await adminApi.completeHousekeepingTask(taskId, body);
        await refresh();
      } catch (cause: unknown) {
        setActionError((current) => ({
          ...current,
          [roomId]:
            cause instanceof AdminApiError ? cause.message : translate(locale, 'admin.actionError'),
        }));
      } finally {
        setPending((current) => ({ ...current, [roomId]: false }));
      }
    },
    [locale, refresh],
  );

  const handleAssignment = useCallback(
    async (taskId: string, roomId: string, expectedVersion: number) => {
      const assigneeId = assignmentDrafts[roomId];
      if (assigneeId === undefined || assigneeId === '') return;
      setPending((current) => ({ ...current, [roomId]: true }));
      setActionError((current) => ({ ...current, [roomId]: '' }));
      try {
        await adminApi.assignHousekeepingTask(taskId, { assigneeId, expectedVersion });
        await refresh();
      } catch (cause: unknown) {
        setActionError((current) => ({
          ...current,
          [roomId]:
            cause instanceof AdminApiError ? cause.message : translate(locale, 'admin.actionError'),
        }));
      } finally {
        setPending((current) => ({ ...current, [roomId]: false }));
      }
    },
    [assignmentDrafts, locale, refresh],
  );

  const handleManagerAction = useCallback(
    async (
      taskId: string,
      roomId: string,
      action: 'verify' | 'reopen',
      expectedVersion: number,
    ) => {
      setPending((current) => ({ ...current, [roomId]: true }));
      setActionError((current) => ({ ...current, [roomId]: '' }));
      try {
        if (action === 'verify') {
          await adminApi.verifyHousekeepingTask(taskId, { expectedVersion });
        } else {
          if (reopenReason.trim() === '') {
            setActionError((current) => ({
              ...current,
              [roomId]: translate(locale, 'admin.reasonRequired'),
            }));
            return;
          }
          await adminApi.reopenHousekeepingTask(taskId, {
            expectedVersion,
            reason: reopenReason.trim(),
          });
          setReopenRoomId(undefined);
          setReopenReason('');
        }
        await refresh();
      } catch (cause: unknown) {
        setActionError((current) => ({
          ...current,
          [roomId]:
            cause instanceof AdminApiError ? cause.message : translate(locale, 'admin.actionError'),
        }));
      } finally {
        setPending((current) => ({ ...current, [roomId]: false }));
      }
    },
    [locale, refresh, reopenReason],
  );

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
              {data === undefined
                ? translate(locale, 'admin.roomBoardLoading')
                : `${translate(locale, 'admin.roomBoardUpdated', { time: new Date(data.generatedAt).toLocaleTimeString(locale) })}${stale ? ` · ${translate(locale, 'admin.roomBoardStale')}` : ''}`}
            </div>
          </div>
        </div>
        <div className="admin-surface__content">
          <div className="admin-filter-toolbar">
            <div className="admin-filter-toolbar__controls">
              <label>
                {translate(locale, 'admin.scheduleDate')}
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label className="admin-filter-toolbar__search">
                {translate(locale, 'admin.roomSearch')}
                <Input
                  placeholder={translate(locale, 'admin.roomSearchPlaceholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
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
              <Button onClick={() => void refresh()} type="button" variant="outline">
                {translate(locale, 'admin.refreshBoard')}
              </Button>
            </div>
            <div className="admin-filter-toolbar__summary">
              {translate(locale, 'admin.activeTasksSummary', { count: roomsWithTasks.length })}
            </div>
          </div>
          {error ? (
            <p className="admin-alert admin-alert--error" role="alert">
              {error}
            </p>
          ) : null}
          {data !== undefined && roomsWithTasks.length === 0 ? (
            <p className="admin-state">{translate(locale, 'admin.noHousekeepingTasks')}</p>
          ) : null}
          {roomsWithTasks.length > 0 ? (
            <AdminDataTable variant="operational">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate(locale, 'admin.room')}</TableHead>
                    <TableHead>{translate(locale, 'admin.roomConcept')}</TableHead>
                    <TableHead>{translate(locale, 'admin.taskType')}</TableHead>
                    <TableHead>{translate(locale, 'admin.taskStatus')}</TableHead>
                    <TableHead>{translate(locale, 'admin.dueTime')}</TableHead>
                    <TableHead>{translate(locale, 'admin.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomsWithTasks.map((room) => {
                    const task = room.activeHousekeepingTask ?? room.latestTurnoverTask;
                    if (!task) return null;
                    const isAssignedStaff =
                      me?.profileCode === 'HOUSEKEEPING_STAFF' && task.assigneeId === me.id;
                    const canStart =
                      task.type === 'TURNOVER' &&
                      isAssignedStaff &&
                      (task.status === 'DUE' || task.status === 'SCHEDULED');
                    const canComplete =
                      task.type === 'TURNOVER' && isAssignedStaff && task.status === 'IN_PROGRESS';
                    const canManage = me?.permissions.includes('housekeeping.task.manage') === true;
                    const canAssign =
                      canManage &&
                      task.type === 'TURNOVER' &&
                      (task.status === 'DUE' || task.status === 'SCHEDULED');
                    const canVerify =
                      canManage &&
                      task.type === 'TURNOVER' &&
                      task.status === 'DONE' &&
                      task.verifiedAt === null;
                    const canReopen =
                      canManage && task.type === 'TURNOVER' && task.status === 'DONE';
                    const actionErr = actionError[room.roomId];
                    return (
                      <TableRow key={room.roomId}>
                        <TableCell data-label={translate(locale, 'admin.room')}>
                          <strong>
                            {translate(locale, 'admin.roomNumber', { number: room.roomNumber })}
                          </strong>
                          <span className="admin-muted room-code">{room.physicalRoomCode}</span>
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.roomConcept')}>
                          <span>{room.roomConcept}</span>
                          <span className="admin-muted">{room.roomTier}</span>
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.taskType')}>
                          {task.type === 'TURNOVER'
                            ? translate(locale, 'admin.taskTurnover')
                            : translate(locale, 'admin.taskArrivalPrep')}
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.taskStatus')}>
                          <AdminStatusBadge tone={getStatusTone(task.status)}>
                            {translate(locale, taskStatusLabels[task.status])}
                          </AdminStatusBadge>
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.dueTime')}>
                          {formatTime(task.dueAt, locale)}
                        </TableCell>
                        <TableCell data-label={translate(locale, 'admin.action')}>
                          <div className="flex flex-wrap gap-2">
                            {canAssign ? (
                              <>
                                <Select
                                  value={
                                    assignmentDrafts[room.roomId] ?? task.assigneeId ?? undefined
                                  }
                                  onValueChange={(value) => {
                                    if (value !== null)
                                      setAssignmentDrafts((current) => ({
                                        ...current,
                                        [room.roomId]: value,
                                      }));
                                  }}
                                >
                                  <SelectTrigger aria-label={translate(locale, 'admin.assignee')}>
                                    <SelectValue
                                      placeholder={translate(locale, 'admin.assignee')}
                                    />
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
                                  onClick={() =>
                                    void handleAssignment(task.taskId, room.roomId, task.version)
                                  }
                                  disabled={
                                    pending[room.roomId] === true ||
                                    (assignmentDrafts[room.roomId] ?? task.assigneeId) === null ||
                                    (assignmentDrafts[room.roomId] ?? task.assigneeId) === undefined
                                  }
                                >
                                  {translate(locale, 'admin.assignTask')}
                                </Button>
                              </>
                            ) : null}
                            {canStart ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  void handleTaskAction(
                                    task.taskId,
                                    room.roomId,
                                    'start',
                                    task.version,
                                  )
                                }
                                disabled={pending[room.roomId] === true}
                              >
                                {translate(locale, 'admin.startTask')}
                              </Button>
                            ) : null}
                            {canComplete ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  void handleTaskAction(
                                    task.taskId,
                                    room.roomId,
                                    'complete',
                                    task.version,
                                  )
                                }
                                disabled={pending[room.roomId] === true}
                              >
                                {translate(locale, 'admin.completeTask')}
                              </Button>
                            ) : null}
                            {canVerify ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void handleManagerAction(
                                    task.taskId,
                                    room.roomId,
                                    'verify',
                                    task.version,
                                  )
                                }
                                disabled={pending[room.roomId] === true}
                              >
                                {translate(locale, 'admin.verifyTask')}
                              </Button>
                            ) : null}
                            {canReopen ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReopenRoomId(room.roomId)}
                                disabled={pending[room.roomId] === true}
                              >
                                {translate(locale, 'admin.reopenTask')}
                              </Button>
                            ) : null}
                            {!canAssign && !canStart && !canComplete && !canVerify && !canReopen ? (
                              <span className="admin-muted">
                                {translate(locale, 'admin.noAction')}
                              </span>
                            ) : null}
                          </div>
                          {actionErr !== undefined && actionErr !== '' ? (
                            <Alert variant="destructive" className="mt-2">
                              <AlertTitle>{translate(locale, 'admin.actionError')}</AlertTitle>
                              <AlertDescription>{actionErr}</AlertDescription>
                            </Alert>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AdminDataTable>
          ) : null}
        </div>
        <AdminDetailSheet
          open={reopenRoomId !== undefined}
          onOpenChange={(open) => {
            if (!open) {
              setReopenRoomId(undefined);
              setReopenReason('');
            }
          }}
          title={translate(locale, 'admin.reopenTask')}
          description={translate(locale, 'admin.reopenTaskReason')}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setReopenRoomId(undefined)}>
                {translate(locale, 'admin.cancel')}
              </Button>
              <Button
                type="button"
                disabled={reopenRoomId === undefined || pending[reopenRoomId] === true}
                onClick={() => {
                  if (reopenRoomId === undefined) return;
                  const taskRoom = roomsWithTasks.find((room) => room.roomId === reopenRoomId);
                  const task = taskRoom?.activeHousekeepingTask ?? taskRoom?.latestTurnoverTask;
                  if (task === undefined || task === null) return;
                  void handleManagerAction(task.taskId, reopenRoomId, 'reopen', task.version);
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
              aria-invalid={
                reopenRoomId !== undefined && reopenReason.trim() === '' ? 'true' : undefined
              }
            />
          </label>
        </AdminDetailSheet>
      </div>
    </section>
  );
}
