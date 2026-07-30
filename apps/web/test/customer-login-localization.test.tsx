import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { CustomerLoginClient } from '../src/app/login/customer-login-client';
import { LocaleProvider } from '../src/components/locale-provider';

describe('customer login localization', () => {
  it('renders the Google login path in English', () => {
    render(
      <LocaleProvider locale="en">
        <CustomerLoginClient
          presentation={{ mode: 'google', providerId: 'google', enabled: false }}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Customer sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Quick lookup without signing in' }),
    ).toBeInTheDocument();
  });
});
