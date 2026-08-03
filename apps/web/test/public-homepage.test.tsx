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
  it('keeps landing discovery separate until a search and directs room browsing to /rooms', async () => {
    // Phase 2 catalog truthfulness: when no catalog is provided the landing
    // page renders an explicit empty / unavailable state instead of falling
    // back to the static hospitality room copy. No fabricated room cards
    // and no "Chi tiết hạng phòng" links should appear.
    render(
      <LocaleProvider locale="vi">
        <PublicLanding />
      </LocaleProvider>,
    );
    expect(screen.queryByRole('heading', { name: 'Hạng phòng còn trống' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Xem tất cả phòng' }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.queryAllByRole('link', { name: 'Chi tiết hạng phòng' })).toHaveLength(0);
    expect(screen.getByTestId('landing-featured-empty')).toBeVisible();
  });

  it('uses one selected hourly tab to serialize only its interval', async () => {
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={vi.fn()} variant="home" />);
    await user.click(screen.getByRole('button', { name: 'Theo giờ' }));
    expect(screen.getByRole('button', { name: 'Theo giờ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Qua đêm' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByLabelText('Nhận phòng')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2099-04-10' } });
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), { target: { value: '11:00' } });
    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps a visible hourly end time synchronized with shortcuts and submits that interval', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={onSearch} variant="home" />);

    await user.click(screen.getByRole('button', { name: 'Theo giờ' }));

    const endTime = screen.getByLabelText('Giờ kết thúc');
    expect(endTime).toBeVisible();

    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2099-04-10' } });
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), { target: { value: '10:00' } });
    expect(endTime).toHaveValue('13:00');

    await user.click(screen.getByRole('button', { name: '5 giờ' }));
    expect(endTime).toHaveValue('15:00');

    fireEvent.change(endTime, { target: { value: '15:30' } });
    expect(screen.getByRole('button', { name: 'Tùy chỉnh' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));
    expect(onSearch).toHaveBeenCalledWith({
      mode: 'hourly',
      checkIn: '2099-04-10T10:00:00+07:00',
      checkOut: '2099-04-10T15:30:00+07:00',
      adults: 1,
      children: 0,
    });
  });

  it('suggests overnight booking when an hourly shortcut crosses midnight', async () => {
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={vi.fn()} variant="home" />);

    await user.click(screen.getByRole('button', { name: 'Theo giờ' }));
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2099-04-10' } });
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), { target: { value: '23:00' } });
    await user.click(screen.getByRole('button', { name: '3 giờ' }));
    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));

    expect(screen.getByRole('alert')).toHaveTextContent('qua đêm');
  });

  it('rejects an hourly interval that is already in the past', async () => {
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={vi.fn()} variant="home" />);

    await user.click(screen.getByRole('button', { name: 'Theo giờ' }));
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2020-04-10' } });
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('Giờ kết thúc'), { target: { value: '13:00' } });
    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));

    expect(screen.getByRole('alert')).toHaveTextContent('trong tương lai');
  });

  it('switches to overnight without retaining hourly fields in the search payload', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={onSearch} variant="home" />);

    await user.click(screen.getByRole('button', { name: 'Theo giờ' }));
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2099-04-10' } });
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), { target: { value: '11:00' } });
    await user.click(screen.getByRole('button', { name: 'Qua đêm' }));

    expect(screen.getByRole('button', { name: 'Qua đêm' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Ngày')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nhận phòng'), {
      target: { value: '2099-04-10T18:00' },
    });
    fireEvent.change(screen.getByLabelText('Trả phòng'), { target: { value: '2099-04-11T08:00' } });
    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));

    expect(onSearch).toHaveBeenCalledWith({
      mode: 'overnight',
      checkIn: '2099-04-10T18:00:00+07:00',
      checkOut: '2099-04-11T08:00:00+07:00',
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
    fireEvent.change(screen.getByLabelText('Nhận phòng'), {
      target: { value: '2099-04-10T11:00' },
    });
    fireEvent.change(screen.getByLabelText('Trả phòng'), { target: { value: '2099-04-10T14:00' } });
    await user.click(screen.getByRole('button', { name: 'Tìm phòng' }));
    expect(push).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Hạng phòng còn trống' })).toBeVisible();
    expect(screen.getByText('Giá đúng khung giờ đã chọn: 300.000 ₫')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Mở trang kết quả đầy đủ' })).toHaveAttribute(
      'href',
      expect.stringContaining('/booking/search?mode=overnight'),
    );
  });
});
