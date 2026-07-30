import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import AdminErrorPage from '../src/app/admin/error';

describe('admin error page', () => {
  it('renders a recoverable error message without exposing internals', () => {
    render(<AdminErrorPage error={new Error('internal')} reset={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Không thể tải trang' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    // Do not leak the raw error message to the user.
    expect(screen.queryByText(/internal/)).not.toBeInTheDocument();
  });

  it('passes accessibility checks', async () => {
    const { container } = render(
      <AdminErrorPage error={new Error('internal')} reset={() => undefined} />,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
