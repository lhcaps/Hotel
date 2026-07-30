import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilitySearchForm } from '../src/components/availability-search-form';
import { PublicLanding } from '../src/components/public-landing';
import { publicApi } from '../src/lib/admin-api';
import { LocaleProvider } from '../src/components/locale-provider';

const push = vi.fn();
vi.mock('../src/lib/admin-api', () => ({
  publicApi: { searchAvailability: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('public booking entry', () => {
  it('keeps landing discovery separate until a search and directs room browsing to /rooms', () => {
    render(
      <LocaleProvider locale="vi">
        <PublicLanding />
      </LocaleProvider>,
    );
    expect(screen.queryByRole('heading', { name: 'Hạng phòng còn trống' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Xem tất cả phòng' })).toHaveLength(2);
    for (const link of screen.getAllByRole('link', { name: 'Xem tất cả phòng' }))
      expect(link).toHaveAttribute('href', '/rooms');
    expect(screen.getAllByRole('link', { name: 'Chi tiết hạng phòng' })).toHaveLength(3);
  });

  it('uses one selected hourly tab to serialize only its interval', async () => {
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={vi.fn()} variant="home" />);
    await user.click(screen.getByRole('button', { name: 'Theo giờ' }));
    expect(screen.getByRole('button', { name: 'Theo giờ' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Qua đêm' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Nhận phòng')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2027-04-10' } });
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), { target: { value: '11:00' } });
    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('switches to overnight without retaining hourly fields in the search payload', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={onSearch} variant="home" />);

    await user.click(screen.getByRole('button', { name: 'Theo giờ' }));
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2027-04-10' } });
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), { target: { value: '11:00' } });
    await user.click(screen.getByRole('button', { name: 'Qua đêm' }));

    expect(screen.getByRole('button', { name: 'Qua đêm' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Ngày')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nhận phòng'), { target: { value: '2027-04-10T18:00' } });
    fireEvent.change(screen.getByLabelText('Trả phòng'), { target: { value: '2027-04-11T08:00' } });
    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));

    expect(onSearch).toHaveBeenCalledWith({
      mode: 'overnight',
      checkIn: '2027-04-10T18:00:00+07:00',
      checkOut: '2027-04-11T08:00:00+07:00',
      adults: 1,
      children: 0,
    });
  });

  it('keeps a valid landing search inline and renders the server offer', async () => {
    vi.mocked(publicApi.searchAvailability).mockResolvedValue({
      items: [
        {
          roomTypeId: '550e8400-e29b-41d4-a716-446655440010',
          roomTypeName: 'Deluxe',
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 3,
          amenities: ['Wi-Fi'],
          availableRoomCount: 1,
          offer: { planLabel: '3 giờ', amountVnd: 300000 },
        },
      ],
    });
    const user = userEvent.setup();
    render(
      <LocaleProvider locale="vi">
        <PublicLanding />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByLabelText('Nhận phòng'), { target: { value: '2027-04-10T11:00' } });
    fireEvent.change(screen.getByLabelText('Trả phòng'), { target: { value: '2027-04-10T14:00' } });
    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));
    expect(push).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Hạng phòng còn trống' })).toBeVisible();
    expect(screen.getByText('Từ 300.000 ₫')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Mở trang kết quả đầy đủ' })).toHaveAttribute(
      'href',
      expect.stringContaining('/booking/search?mode=overnight'),
    );
  });
});
