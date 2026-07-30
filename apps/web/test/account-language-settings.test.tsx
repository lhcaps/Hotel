import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountLanguageSettings } from '../src/components/account-language-settings';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('account language settings', () => {
  it('shows the current locale and sends the selected locale through the existing action', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { reload } });

    render(<AccountLanguageSettings locale="vi" />);

    expect(screen.getByRole('radio', { name: 'Tiếng Việt' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Áp dụng ngôn ngữ' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng ngôn ngữ' }));

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/locale',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ locale: 'en' }),
        }),
      ),
    );
    expect(reload).toHaveBeenCalledOnce();
  });
});
