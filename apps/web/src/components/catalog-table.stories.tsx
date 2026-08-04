import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { Room } from '@room/contracts';

import { CatalogTable } from './catalog-table';

const rooms: readonly Room[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    propertyId: '00000000-0000-4000-8000-000000000002',
    roomTypeId: '00000000-0000-4000-8000-000000000003',
    roomNumber: '101',
    physicalRoomCode: '101',
    status: 'ACTIVE',
    housekeepingStatus: 'CLEAN',
    createdAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-21T10:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    propertyId: '00000000-0000-4000-8000-000000000002',
    roomTypeId: '00000000-0000-4000-8000-000000000003',
    roomNumber: '102',
    physicalRoomCode: '102',
    status: 'INACTIVE',
    housekeepingStatus: 'DIRTY',
    createdAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-21T10:00:00.000Z',
  },
];

function RoomTableStory() {
  return (
    <CatalogTable<Room>
      archive={async (id) => {
        const room = rooms.find((candidate) => candidate.id === id);
        if (room === undefined) throw new Error('Room not found');
        return { ...room, status: 'INACTIVE' };
      }}
      archiveLabel={(room) => `Lưu trữ phòng ${room.roomNumber}`}
      columns={[{ heading: 'Số phòng', cell: (room) => room.roomNumber }]}
      description="Danh sách phòng vật lý theo thứ tự số phòng."
      emptyMessage="Chưa có phòng để hiển thị."
      load={async () => ({ page: 1, pageSize: 20, items: rooms })}
      title="Phòng"
    />
  );
}

const meta = {
  title: 'Admin/CatalogTable',
  component: RoomTableStory,
} satisfies Meta<typeof RoomTableStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
