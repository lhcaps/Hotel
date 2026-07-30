'use client';

import { useEffect, useState } from 'react';

import {
  AdminApiError,
  adminApi,
  type PaymentProviderAdmin,
  type PaymentProviderUpdate,
} from '../lib/admin-api';

type EditableProvider = PaymentProviderAdmin & { readonly maintenanceMessage: string };

function editable(provider: PaymentProviderAdmin): EditableProvider {
  return { ...provider, maintenanceMessage: provider.maintenanceMessage ?? '' };
}

function updatePayload(provider: EditableProvider): PaymentProviderUpdate {
  return {
    enabled: provider.enabled,
    displayName: provider.displayName.trim(),
    displayOrder: provider.displayOrder,
    checkoutExpiryMinutes: provider.checkoutExpiryMinutes,
    maintenanceMessage: provider.maintenanceMessage.trim() || null,
  };
}

export function PaymentProviderManager() {
  const [providers, setProviders] = useState<readonly EditableProvider[]>();
  const [saving, setSaving] = useState<'MOMO' | 'VNPAY' | null>(null);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void adminApi
      .listPaymentProviders()
      .then((items) => setProviders(items.map(editable)))
      .catch(() => setMessage('Unable to load payment-provider settings.'));
  }, []);

  function change(provider: 'MOMO' | 'VNPAY', patch: Partial<EditableProvider>) {
    setProviders((current) =>
      current?.map((item) => (item.provider === provider ? { ...item, ...patch } : item)),
    );
  }

  async function save(provider: EditableProvider) {
    if (saving !== null) return;
    if (
      provider.displayName.trim() === '' ||
      provider.displayOrder < 0 ||
      provider.checkoutExpiryMinutes < 1 ||
      provider.checkoutExpiryMinutes > 60
    ) {
      setMessage(
        'Enter a display name, non-negative order, and an expiry between 1 and 60 minutes.',
      );
      return;
    }
    setSaving(provider.provider);
    setMessage(undefined);
    try {
      const updated = await adminApi.updatePaymentProvider(
        provider.provider,
        updatePayload(provider),
      );
      change(provider.provider, editable(updated));
      setMessage(`${provider.provider} settings saved.`);
    } catch (error) {
      setMessage(
        error instanceof AdminApiError
          ? error.problem.detail
          : 'Unable to save payment-provider settings.',
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="admin-page" aria-labelledby="payment-providers-heading">
      <div className="page-heading">
        <div>
          <h1 id="payment-providers-heading">Payment providers</h1>
          <p>
            Manage checkout availability and display settings. Credentials are managed only by
            server configuration.
          </p>
        </div>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {providers === undefined ? (
        <p aria-live="polite">Loading payment providers…</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {providers.map((provider) => (
            <form
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              key={provider.provider}
              onSubmit={(event) => {
                event.preventDefault();
                void save(provider);
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{provider.provider}</h2>
                <span className={provider.configured ? 'text-emerald-700' : 'text-amber-800'}>
                  {provider.configured ? `Configured (${provider.environment})` : 'Not configured'}
                </span>
              </div>
              <label className="mt-4 flex items-center gap-2">
                <input
                  checked={provider.enabled}
                  disabled={!provider.configured || saving !== null}
                  onChange={(event) => change(provider.provider, { enabled: event.target.checked })}
                  type="checkbox"
                />
                Enable this provider for new payment attempts
              </label>
              <label className="mt-3 block">
                Display name
                <input
                  className="mt-1 block w-full"
                  maxLength={120}
                  onChange={(event) =>
                    change(provider.provider, { displayName: event.target.value })
                  }
                  required
                  value={provider.displayName}
                />
              </label>
              <label className="mt-3 block">
                Display order
                <input
                  className="mt-1 block w-full"
                  min={0}
                  onChange={(event) =>
                    change(provider.provider, { displayOrder: Number(event.target.value) })
                  }
                  type="number"
                  value={provider.displayOrder}
                />
              </label>
              <label className="mt-3 block">
                Checkout expiry (minutes)
                <input
                  className="mt-1 block w-full"
                  max={60}
                  min={1}
                  onChange={(event) =>
                    change(provider.provider, { checkoutExpiryMinutes: Number(event.target.value) })
                  }
                  type="number"
                  value={provider.checkoutExpiryMinutes}
                />
              </label>
              <label className="mt-3 block">
                Maintenance message (optional)
                <textarea
                  className="mt-1 block w-full"
                  maxLength={500}
                  onChange={(event) =>
                    change(provider.provider, { maintenanceMessage: event.target.value })
                  }
                  value={provider.maintenanceMessage}
                />
              </label>
              <button className="primary-button mt-4" disabled={saving !== null} type="submit">
                {saving === provider.provider ? 'Saving…' : 'Save settings'}
              </button>
            </form>
          ))}
        </div>
      )}
    </section>
  );
}
