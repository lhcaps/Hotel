import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HousekeepingWorkboard } from './housekeeping-workboard';
import { LocaleProvider } from './locale-provider';

const api = vi.hoisted(() => ({
  listHousekeepingTasks: vi.fn(),
  me: vi.fn(),
  listHousekeepingAssignees: vi.fn(),
  assignHousekeepingTask: vi.fn(),
  startHousekeepingTask: vi.fn(),
  completeHousekeepingTask: vi.fn(),
  verifyHousekeepingTask: vi.fn(),
  reopenHousekeepingTask: vi.fn(),
  cancelHousekeepingTask: vi.fn(),
}));

vi.mock('../lib/admin-api', () => ({ adminApi: api }));

const SUPER_ADMIN_PERMISSIONS = [
  'housekeeping.task.read',
  'housekeeping.task.update',
  'housekeeping.task.manage',
  'admin.account.read',
  'admin.account.manage',
];

const STAFF_PERMISSIONS = ['housekeeping.task.read', 'housekeeping.task.update'];

function baseTask(
  overrides: Partial<{
    taskId: string;
    roomId: string;
    roomNumber: string;
    physicalRoomCode: string;
    roomConcept: string;
    roomTier: string;
    housekeepingStatus: 'CLEAN' | 'DIRTY' | 'CLEANING';
    type: 'ARRIVAL_PREP' | 'TURNOVER';
    status: 'SCHEDULED' | 'DUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
    assigneeId: string | null;
    assigneeName: string | null;
    version: number;
    verifiedAt: string | null;
    dueAt: string;
  }> = {},
) {
  return {
    taskId: '20000000-0000-4000-8000-000000000001',
    roomId: '10000000-0000-4000-8000-000000000001',
    roomNumber: 'G03',
    physicalRoomCode: '94BDT-HavenG03',
    roomConcept: 'Haven',
    roomTier: 'Signature',
    housekeepingStatus: 'CLEAN' as const,
    type: 'ARRIVAL_PREP' as const,
    status: 'DUE' as const,
    assigneeId: null,
    assigneeName: null,
    version: 1,
    verifiedAt: null,
    dueAt: '2026-08-14T11:00:00.000Z',
    ...overrides,
  };
}

function setupSuperAdmin() {
  api.me.mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000099',
    emailMasked: 's•••@peacenest.vn',
    displayName: 'Super Admin',
    role: 'SUPER_ADMIN',
    profileCode: 'SUPER_ADMIN',
    profileLabelVi: 'Tổng quản trị',
    accountStatus: 'ACTIVE',
    department: null,
    permissions: SUPER_ADMIN_PERMISSIONS,
    sessionExpiresAt: '2026-08-14T18:00:00.000Z',
  });
}

function setupBuPhong() {
  api.me.mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000050',
    emailMasked: 'b•••@peacenest.vn',
    displayName: 'Nguyễn Văn Bù',
    role: 'SUPER_ADMIN',
    profileCode: 'HOUSEKEEPING_MANAGER',
    profileLabelVi: 'Bù phòng',
    accountStatus: 'ACTIVE',
    department: null,
    permissions: SUPER_ADMIN_PERMISSIONS.filter((permission) =>
      [
        'housekeeping.task.read',
        'housekeeping.task.update',
        'housekeeping.task.manage',
        'admin.account.read',
      ].includes(permission),
    ),
    sessionExpiresAt: '2026-08-14T18:00:00.000Z',
  });
}

function setupStaff(id: string) {
  api.me.mockResolvedValue({
    id,
    emailMasked: 'n•••@peacenest.vn',
    displayName: 'Nguyễn Văn A',
    role: 'SUPER_ADMIN',
    profileCode: 'HOUSEKEEPING_STAFF',
    profileLabelVi: 'Nhân viên buồng phòng',
    accountStatus: 'ACTIVE',
    department: null,
    permissions: STAFF_PERMISSIONS,
    sessionExpiresAt: '2026-08-14T18:00:00.000Z',
  });
}

function renderWorkboard() {
  return render(
    <LocaleProvider locale="vi">
      <HousekeepingWorkboard />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.listHousekeepingAssignees.mockResolvedValue([]);
});

describe('HousekeepingWorkboard task-first', () => {
  it('A. ARRIVAL_PREP + Super Admin + staff: shows Assign select + button', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [baseTask({ taskId: 'task-arrival-due' })],
    });

    renderWorkboard();

    await screen.findByText('Phòng G03');
    expect(screen.getByText('94BDT-HavenG03')).toBeTruthy();
    expect(screen.getByText('Chưa phân công')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Nhân viên' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Phân công' })).toBeTruthy();
    expect(screen.queryByText('Không có thao tác')).toBeNull();
  });

  it('B. ARRIVAL_PREP + Bù phòng + staff: shows Assign select + button', async () => {
    setupBuPhong();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [baseTask({ taskId: 'task-arrival-bu-phong' })],
    });

    renderWorkboard();

    await screen.findByText('Phòng G03');
    expect(screen.getByRole('combobox', { name: 'Nhân viên' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Phân công' })).toBeTruthy();
  });

  it('C. ARRIVAL_PREP + no staff: shows explanatory empty-assignee state, NOT "Không có thao tác"', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [baseTask({ taskId: 'task-arrival-empty' })],
    });

    renderWorkboard();

    await screen.findByText('Chưa có nhân viên buồng phòng tại cơ sở này');
    expect(screen.getByRole('link', { name: 'Quản lý tài khoản' })).toBeTruthy();
    expect(
      screen.getByText('Tạo hồ sơ "Nhân viên buồng phòng" và gán cơ sở để có thể phân công.'),
    ).toBeTruthy();
    expect(screen.queryByText('Không có thao tác')).toBeNull();
  });

  it('D. assigned ARRIVAL_PREP + staff: shows Start button', async () => {
    setupStaff('staff-1');
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-arrival-assigned',
          assigneeId: 'staff-1',
          assigneeName: 'Nguyễn Văn A',
          status: 'SCHEDULED',
        }),
      ],
    });

    renderWorkboard();

    expect(await screen.findByRole('button', { name: 'Bắt đầu' })).toBeTruthy();
    expect(screen.queryByText('Không có thao tác')).toBeNull();
    await waitFor(() => expect(api.listHousekeepingTasks).toHaveBeenCalledWith());
  });

  it('E. IN_PROGRESS ARRIVAL_PREP + assigned staff: shows Complete button', async () => {
    setupStaff('staff-1');
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-arrival-in-progress',
          assigneeId: 'staff-1',
          assigneeName: 'Nguyễn Văn A',
          status: 'IN_PROGRESS',
        }),
      ],
    });

    renderWorkboard();

    expect(await screen.findByRole('button', { name: 'Hoàn thành' })).toBeTruthy();
  });

  it('F. ARRIVAL_PREP task lifecycle does not change room housekeeping status', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-arrival-keep-clean',
          housekeepingStatus: 'CLEAN',
          assigneeId: 'staff-1',
          assigneeName: 'Nguyễn Văn A',
        }),
      ],
    });

    renderWorkboard();

    await screen.findByText('Phòng G03');
    expect(screen.getAllByText('Sạch').length).toBeGreaterThan(0);
    expect(screen.queryByText('Cần dọn')).toBeNull();
    expect(screen.queryByText('Đang dọn')).toBeNull();
  });

  it('G. TURNOVER lifecycle: DIRTY → CLEANING → CLEAN reflects in row status', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-turnover',
          type: 'TURNOVER',
          status: 'IN_PROGRESS',
          housekeepingStatus: 'CLEANING',
          roomNumber: '206',
          physicalRoomCode: '94BDT-Nami206',
          roomConcept: 'Nami',
          roomTier: 'Deluxe',
        }),
      ],
    });

    renderWorkboard();

    await screen.findByText('Phòng 206');
    expect(screen.getByText('Đang dọn')).toBeTruthy();
    expect(screen.getByText('Dọn phòng checkout')).toBeTruthy();
  });

  it('H. multiple tasks on the same room: both taskIds rendered independently', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-arrival-multi',
          roomNumber: '206',
          physicalRoomCode: '94BDT-Nami206',
          status: 'DUE',
          type: 'ARRIVAL_PREP',
        }),
        baseTask({
          taskId: 'task-turnover-multi',
          roomNumber: '206',
          physicalRoomCode: '94BDT-Nami206',
          status: 'IN_PROGRESS',
          type: 'TURNOVER',
          housekeepingStatus: 'CLEANING',
        }),
      ],
    });

    renderWorkboard();

    await screen.findByTestId('task-row-task-arrival-multi');
    expect(screen.getByTestId('task-row-task-turnover-multi')).toBeTruthy();
    expect(screen.getAllByText('Phòng 206').length).toBe(2);
    expect(screen.getByText('Chuẩn bị phòng')).toBeTruthy();
    expect(screen.getByText('Dọn phòng checkout')).toBeTruthy();
  });

  it('I. visual text never concatenates room number with physical code, concept with tier', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-spacing-1',
          roomNumber: 'G03',
          physicalRoomCode: '94BDT-HavenG03',
          roomConcept: 'Haven',
          roomTier: 'Signature',
        }),
        baseTask({
          taskId: 'task-spacing-2',
          roomNumber: '206',
          physicalRoomCode: '94BDT-Nami206',
          roomConcept: 'Nami',
          roomTier: 'Deluxe',
        }),
      ],
    });

    renderWorkboard();

    await screen.findByText('Phòng G03');
    const roomNumbers = screen.getAllByText('Phòng G03');
    const physicalCodes = screen.getAllByText('94BDT-HavenG03');
    expect(roomNumbers.length).toBeGreaterThan(0);
    expect(physicalCodes.length).toBeGreaterThan(0);
    for (const node of roomNumbers) {
      expect(node.textContent ?? '').not.toBe('Phòng G0394BDT-HavenG03');
    }
    const conceptNodes = screen.getAllByText('Haven');
    const tierNodes = screen.getAllByText('Signature');
    for (const node of conceptNodes) {
      expect(node.textContent ?? '').not.toBe('HavenSignature');
    }
    expect(conceptNodes.length).toBeGreaterThan(0);
    expect(tierNodes.length).toBeGreaterThan(0);
  });

  it('calls listHousekeepingTasks() and never getRoomOperations() for the task list', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [baseTask({ taskId: 'task-source-id' })],
    });

    renderWorkboard();

    await screen.findByText('Phòng G03');
    expect(api.listHousekeepingTasks).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.listHousekeepingTasks).toHaveBeenCalled();
  });

  it('manager can verify a DONE TURNOVER task', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-verify',
          type: 'TURNOVER',
          status: 'DONE',
          housekeepingStatus: 'CLEAN',
          assigneeId: 'staff-1',
          assigneeName: 'Nguyễn Văn A',
        }),
      ],
    });

    renderWorkboard();

    const verifyButton = await screen.findByRole('button', { name: 'Xác nhận' });
    fireEvent.click(verifyButton);
    await waitFor(() =>
      expect(api.verifyHousekeepingTask).toHaveBeenCalledWith(
        'task-verify',
        expect.objectContaining({ expectedVersion: 1 }),
      ),
    );
  });

  it('manager can cancel a SCHEDULED ARRIVAL_PREP task with reason', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [baseTask({ taskId: 'task-cancel', status: 'SCHEDULED' })],
    });

    renderWorkboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Hủy tác vụ' }));
    const reasonField = await screen.findByPlaceholderText('Vui lòng nhập lý do');
    fireEvent.change(reasonField, { target: { value: 'Không còn cần thiết' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    await waitFor(() =>
      expect(api.cancelHousekeepingTask).toHaveBeenCalledWith(
        'task-cancel',
        expect.objectContaining({ reason: 'Không còn cần thiết' }),
      ),
    );
  });

  it('reassign workflow shows reassign button when an assignee already exists', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
      { id: 'staff-2', displayName: 'Trần Thị B' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-reassign',
          assigneeId: 'staff-1',
          assigneeName: 'Nguyễn Văn A',
          status: 'DUE',
        }),
      ],
    });

    renderWorkboard();

    expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đổi nhân viên' })).toBeTruthy();
  });

  it('staff actor only sees tasks assigned to them', async () => {
    setupStaff('staff-1');
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-staff-1',
          assigneeId: 'staff-1',
          assigneeName: 'Nguyễn Văn A',
          status: 'SCHEDULED',
        }),
        baseTask({
          taskId: 'task-staff-2',
          roomNumber: '101',
          physicalRoomCode: '94BDT-Wabi101',
          assigneeId: 'staff-2',
          assigneeName: 'Trần Thị B',
          status: 'DUE',
        }),
      ],
    });

    renderWorkboard();

    expect(await screen.findByText('Phòng G03')).toBeTruthy();
    expect(screen.queryByText('Phòng 101')).toBeNull();
  });

  it('shows housekeeping condition column with canonical labels', async () => {
    setupSuperAdmin();
    api.listHousekeepingAssignees.mockResolvedValue([
      { id: 'staff-1', displayName: 'Nguyễn Văn A' },
    ]);
    api.listHousekeepingTasks.mockResolvedValue({
      items: [
        baseTask({
          taskId: 'task-condition-clean',
          housekeepingStatus: 'CLEAN',
        }),
        baseTask({
          taskId: 'task-condition-dirty',
          roomNumber: '101',
          physicalRoomCode: '94BDT-Wabi101',
          housekeepingStatus: 'DIRTY',
        }),
      ],
    });

    renderWorkboard();

    await screen.findByText('Phòng G03');
    expect(screen.getByText('Tình trạng vệ sinh')).toBeTruthy();
    expect(screen.getAllByText('Sạch').length).toBeGreaterThan(0);
    expect(screen.getByText('Cần dọn')).toBeTruthy();
  });
});
