import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { vi } from 'vitest';

import { AvailabilitySearchForm } from '../src/components/availability-search-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('public interval search accessibility', () => {
  it('provides one labelled interval form without pricing mode controls', () => {
    render(<AvailabilitySearchForm />);

    expect(screen.getByTestId('availability-check-in-date')).toBeTruthy();
    expect(screen.getByTestId('availability-check-in-time')).toBeTruthy();
    expect(screen.getByTestId('availability-check-out-date')).toBeTruthy();
    expect(screen.getByTestId('availability-check-out-time')).toBeTruthy();
    expect(screen.getByTestId('availability-adults')).toBeTruthy();
    expect(screen.getByTestId('availability-children')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Theo giờ|Qua đêm/i })).not.toBeInTheDocument();
  });

  it('does not reveal a physical-room choice and has no axe violations', async () => {
    const { container } = render(<AvailabilitySearchForm />);

    expect(container.textContent).not.toMatch(/room number|room id|số phòng/i);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
