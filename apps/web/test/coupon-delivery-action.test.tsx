import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CouponDeliveryAction } from '../src/components/coupon-delivery-action';
import { adminApi } from '../src/lib/admin-api';

vi.mock('../src/lib/admin-api', () => ({
  AdminApiError: class AdminApiError extends Error {},
  adminApi: {
    listCoupons: vi.fn(),
    sendAdminBookingCoupons: vi.fn(),
  },
}));

describe('CouponDeliveryAction', () => {
  afterEach(() => vi.clearAllMocks());

  it('requires an explicit confirmation before queueing selected available coupons', async () => {
    vi.mocked(adminApi.listCoupons).mockResolvedValue({
      page: 1,
      pageSize: 100,
      items: [
        { code: 'WELCOME10', lifecycle: 'AVAILABLE' },
        { code: 'OLD10', lifecycle: 'EXPIRED' },
      ],
    } as never);
    vi.mocked(adminApi.sendAdminBookingCoupons).mockResolvedValue(undefined);

    render(<CouponDeliveryAction bookingCode="BK-ABCDEF" />);

    await screen.findByLabelText('WELCOME10');
    expect(screen.queryByLabelText('OLD10')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('WELCOME10'));
    expect(screen.getByRole('button', { name: 'Xếp hàng gửi coupon' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Xác nhận gửi WELCOME10/));
    fireEvent.click(screen.getByRole('button', { name: 'Xếp hàng gửi coupon' }));

    await waitFor(() => expect(adminApi.sendAdminBookingCoupons).toHaveBeenCalledTimes(1));
    expect(adminApi.sendAdminBookingCoupons).toHaveBeenCalledWith(
      'BK-ABCDEF',
      ['WELCOME10'],
      expect.any(String),
    );
    expect(await screen.findByText(/Đã xếp hàng gửi coupon/)).toBeInTheDocument();
  });
});
