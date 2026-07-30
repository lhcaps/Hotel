import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { RoomHousekeepingManager } from '../src/components/room-housekeeping-manager';

vi.mock('../src/lib/admin-api', () => ({
  adminApi: {
    listRooms: vi.fn().mockResolvedValue({
      items: [{ id: 'room-1', roomNumber: 'S-01', status: 'ACTIVE', housekeepingStatus: 'DIRTY' }],
    }),
    updateRoomHousekeeping: vi.fn(),
  },
}));

describe('RoomHousekeepingManager', () => {
  it('shows a text housekeeping state and a labelled admin control', async () => {
    render(<RoomHousekeepingManager />);
    expect(await screen.findByText('S-01')).toBeInTheDocument();
    expect(screen.getByLabelText('Housekeeping for S-01')).toHaveValue('DIRTY');
  });
});
