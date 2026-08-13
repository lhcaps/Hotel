import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { LocaleProvider } from '../src/components/locale-provider';
import {
  AdminTab,
  AdminTabContent,
  AdminTabList,
  AdminTabs,
  AdminTopbar,
} from '../src/components/admin/admin-ui';
import { SidebarProvider } from '../src/components/ui/sidebar';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockReturnValue({
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }),
});

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

function renderWithLocale(children: React.ReactNode) {
  return render(
    <LocaleProvider locale="en">
      <SidebarProvider>{children}</SidebarProvider>
    </LocaleProvider>,
  );
}

describe('ADMIN shared interactions', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('opens an authorized command palette and navigates to its selected destination', async () => {
    const user = userEvent.setup();
    renderWithLocale(
      <AdminTopbar
        commandDestinations={[{ href: '/admin/rooms', label: 'Rooms' }]}
        propertyContext="PeaceNest Hotel"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();

    await user.click(screen.getByText('Rooms'));
    expect(push).toHaveBeenCalledWith('/admin/rooms');
  });

  it('opens quick search from the keyboard and keeps unsupported property context non-interactive', async () => {
    const user = userEvent.setup();
    renderWithLocale(<AdminTopbar propertyContext="PeaceNest Hotel" />);

    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByLabelText('Property').tagName).toBe('SPAN');
  });

  it('renders one shared tab indicator and changes the active tab with the keyboard', async () => {
    const user = userEvent.setup();
    renderWithLocale(
      <AdminTabs defaultValue="staff">
        <AdminTabList variant="line" aria-label="Account type">
          <AdminTab value="staff">Staff</AdminTab>
          <AdminTab value="customers">Customers</AdminTab>
        </AdminTabList>
        <AdminTabContent value="staff">Staff panel</AdminTabContent>
        <AdminTabContent value="customers">Customer panel</AdminTabContent>
      </AdminTabs>,
    );

    expect(document.querySelectorAll("[data-slot='admin-tabs-indicator']")).toHaveLength(1);
    const staff = screen.getByRole('tab', { name: 'Staff' });
    staff.focus();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(screen.getByRole('tab', { name: 'Customers' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Customer panel')).toBeVisible();
  });
});
