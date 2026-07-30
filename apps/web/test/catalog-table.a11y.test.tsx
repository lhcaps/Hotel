import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import type { Room } from '@room/contracts';

import { CatalogTable } from '../src/components/catalog-table';

const room: Room = {
  id: '00000000-0000-4000-8000-000000000001',
  propertyId: '00000000-0000-4000-8000-000000000002',
  roomTypeId: '00000000-0000-4000-8000-000000000003',
  roomNumber: '101',
  status: 'ACTIVE',
  createdAt: '2026-07-21T10:00:00.000Z',
  updatedAt: '2026-07-21T10:00:00.000Z',
};

describe('CatalogTable accessibility', () => {
  it('renders an accessible catalog table with a labelled archive action', async () => {
    const { container } = render(
      <CatalogTable<Room>
        archive={async () => ({ ...room, status: 'INACTIVE' })}
        archiveLabel={(item) => `Lưu trữ phòng ${item.roomNumber}`}
        columns={[{ heading: 'Số phòng', cell: (item) => item.roomNumber }]}
        description="Danh sách phòng vật lý theo thứ tự số phòng."
        emptyMessage="Chưa có phòng để hiển thị."
        load={async () => ({ page: 1, pageSize: 20, items: [room] })}
        title="Phòng"
      />,
    );

    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Lưu trữ phòng 101' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
