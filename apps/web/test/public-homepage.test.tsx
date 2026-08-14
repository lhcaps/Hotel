import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilitySearchForm } from '../src/components/availability-search-form';
import { PublicLanding } from '../src/components/public-landing';
import { LocaleProvider } from '../src/components/locale-provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('public booking entry', () => {
  it('keeps landing discovery truthful when the catalog is unavailable', () => {
    render(
      <LocaleProvider locale="vi">
        <PublicLanding />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('landing-featured-empty')).toBeVisible();
    expect(screen.queryAllByRole('link', { name: /Chi tiết hạng phòng/i })).toHaveLength(0);
  });

  it('submits a complete future interval without a client-selected mode', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={onSearch} variant="home" />);

    fireEvent.change(screen.getByTestId('availability-check-in-date'), {
      target: { value: '2099-04-10' },
    });
    fireEvent.change(screen.getByTestId('availability-check-in-time'), {
      target: { value: '10:00' },
    });
    fireEvent.change(screen.getByTestId('availability-check-out-date'), {
      target: { value: '2099-04-11' },
    });
    fireEvent.change(screen.getByTestId('availability-check-out-time'), {
      target: { value: '11:30' },
    });
    fireEvent.change(screen.getByTestId('availability-adults'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('availability-children'), { target: { value: '1' } });
    await user.click(screen.getByTestId('availability-submit'));

    expect(onSearch).toHaveBeenCalledWith({
      checkIn: '2099-04-10T10:00:00+07:00',
      checkOut: '2099-04-11T11:30:00+07:00',
      adults: 2,
      children: 1,
    });
  });

  it('permits arbitrary customer minute selection without a fifteen-minute grid', () => {
    render(<AvailabilitySearchForm onSearch={vi.fn()} variant="home" />);

    expect(screen.getByTestId('availability-check-in-time')).toHaveAttribute('step', '60');
    expect(screen.getByTestId('availability-check-out-time')).toHaveAttribute('step', '60');
  });

  it('rejects a past interval before requesting availability', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<AvailabilitySearchForm onSearch={onSearch} variant="home" />);

    fireEvent.change(screen.getByTestId('availability-check-in-date'), {
      target: { value: '2020-04-10' },
    });
    fireEvent.change(screen.getByTestId('availability-check-in-time'), {
      target: { value: '10:00' },
    });
    fireEvent.change(screen.getByTestId('availability-check-out-date'), {
      target: { value: '2020-04-10' },
    });
    fireEvent.change(screen.getByTestId('availability-check-out-time'), {
      target: { value: '13:00' },
    });
    await user.click(screen.getByTestId('availability-submit'));

    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
