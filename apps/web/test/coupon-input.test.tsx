import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CouponInput } from '../src/components/coupon-input';
import { LocaleProvider } from '../src/components/locale-provider';

describe('CouponInput', () => {
  it('renders English controls without translating the canonical coupon code', () => {
    render(
      <LocaleProvider locale="en">
        <CouponInput
          appliedCode="SUMMER-50K"
          errorMessage={null}
          pending={false}
          onApply={vi.fn()}
          onClear={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Coupon code (optional)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove coupon' })).toBeInTheDocument();
    expect(screen.getByTestId('coupon-applied')).toHaveTextContent('SUMMER-50K');
    expect(document.body.textContent).not.toContain('Mã giảm giá');
  });

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends only the typed couponCode to onApply and trims whitespace', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CouponInput
        appliedCode={null}
        errorMessage={null}
        pending={false}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Mã giảm giá'), '  summer-50k  ');
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith('summer-50k');
  });

  it('renders an explicit clear button when a coupon is applied and emits empty string on click', async () => {
    const onClear = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CouponInput
        appliedCode="SUMMER-50K"
        errorMessage={null}
        pending={false}
        onApply={vi.fn()}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Bỏ mã' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not render a clear button when no coupon is applied', () => {
    render(
      <CouponInput
        appliedCode={null}
        errorMessage={null}
        pending={false}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Bỏ mã' })).toBeNull();
  });

  it('displays an accessible applied-coupon confirmation without leaking the code to URL/storage', () => {
    render(
      <CouponInput
        appliedCode="SUMMER-50K"
        errorMessage={null}
        pending={false}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const applied = screen.getByTestId('coupon-applied');
    expect(applied).toHaveTextContent('SUMMER-50K');
    expect(globalThis.location.search).not.toContain('SUMMER-50K');
    expect(globalThis.location.hash).not.toContain('SUMMER-50K');
    const localStorageDump = JSON.stringify(window.localStorage);
    const sessionStorageDump = JSON.stringify(window.sessionStorage);
    expect(localStorageDump).not.toContain('SUMMER-50K');
    expect(sessionStorageDump).not.toContain('SUMMER-50K');
  });

  it('surfaces a safe Vietnamese error message', () => {
    render(
      <CouponInput
        appliedCode={null}
        errorMessage="Mã giảm giá không hợp lệ."
        pending={false}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const error = screen.getByTestId('coupon-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('Mã giảm giá không hợp lệ.');
    const input = screen.getByLabelText('Mã giảm giá');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks duplicate submits while a request is in flight', async () => {
    let resolveApply: (() => void) | undefined;
    const onApply = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveApply = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <CouponInput
        appliedCode={null}
        errorMessage={null}
        pending={false}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Mã giảm giá'), 'SUMMER');
    const button = screen.getByRole('button', { name: 'Áp dụng' });
    await user.click(button);
    await user.click(button);
    expect(onApply).toHaveBeenCalledTimes(1);
    resolveApply?.();
  });

  it('respects pending state by disabling both action buttons', () => {
    render(
      <CouponInput
        appliedCode="SUMMER-50K"
        errorMessage={null}
        pending={true}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Đang kiểm tra…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bỏ mã' })).toBeDisabled();
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <CouponInput
        appliedCode="SUMMER-50K"
        errorMessage={null}
        pending={false}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
