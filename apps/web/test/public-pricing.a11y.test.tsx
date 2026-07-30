import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AvailabilitySearchForm } from '../src/components/availability-search-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('public pricing accessibility', () => {
  it('switches booking modes without exposing client-side pricing', async () => {
    const user = userEvent.setup();
    render(<AvailabilitySearchForm />);

    await user.click(screen.getByRole('button', { name: 'Theo giờ' }));
    expect(screen.getByLabelText('Ngày')).toBeTruthy();
    expect(screen.getByLabelText('Giờ bắt đầu')).toBeTruthy();
    expect(screen.getByText('Thời lượng')).toBeTruthy();
    expect(screen.queryByText(/từ.*đ|VND|giá từ/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Qua đêm' }));
    expect(screen.getByLabelText('Nhận phòng')).toBeTruthy();
    expect(screen.getByLabelText('Trả phòng')).toBeTruthy();
  });

  it('provides labelled 15-minute availability controls without physical-room details', async () => {
    const { container } = render(<AvailabilitySearchForm />);
    expect(screen.getByRole('heading', { name: 'Tìm phòng' })).toBeTruthy();
    expect(screen.getByLabelText('Nhận phòng').getAttribute('step')).toBe('900');
    expect(screen.getByLabelText('Trả phòng').getAttribute('step')).toBe('900');
    expect(screen.getByRole('button', { name: 'Tìm phòng' })).toBeTruthy();
    expect(container.textContent).not.toMatch(/số phòng|room number|room id/i);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
