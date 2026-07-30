import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CustomerProfileClient } from '../src/app/account/profile/customer-profile-client';
import { LocaleProvider } from '../src/components/locale-provider';

describe('customer profile localization', () => {
  it('renders editable profile controls in English', () => {
    render(
      <LocaleProvider locale="en">
        <CustomerProfileClient
          apiBase="http://api.local/api/v1"
          initialProfile={{
            userId: 'user-1',
            email: 'guest@example.test',
            name: 'Guest',
            phone: null,
            addressLine1: null,
            addressLine2: null,
            ward: null,
            district: null,
            province: null,
            postalCode: null,
            countryCode: 'VN',
            updatedAt: '2027-01-01T00:00:00.000Z',
          }}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Customer profile' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Full name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeInTheDocument();
  });
});
