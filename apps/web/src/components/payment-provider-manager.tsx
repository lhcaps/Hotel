'use client';

import { useEffect, useState } from 'react';

import {
  AdminApiError,
  adminApi,
  type PaymentProviderAdmin,
  type PaymentProviderUpdate,
} from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { AdminPageHeader, AdminStatusBadge } from './admin/admin-ui';

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
  const locale = useLocale();
  const [providers, setProviders] = useState<readonly EditableProvider[]>();
  const [saving, setSaving] = useState<'MOMO' | 'VNPAY' | null>(null);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void adminApi
      .listPaymentProviders()
      .then((items) => setProviders(items.map(editable)))
      .catch(() => setMessage(translate(locale, 'admin.loadErrorHeading')));
  }, [locale]);
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
      setMessage(translate(locale, 'admin.providerValidation'));
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
      setMessage(translate(locale, 'admin.providerSaved', { provider: provider.provider }));
    } catch (error) {
      setMessage(
        error instanceof AdminApiError
          ? error.problem.detail
          : translate(locale, 'admin.loadErrorHeading'),
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="admin-page" aria-labelledby="payment-providers-heading">
      <AdminPageHeader
        eyebrow={translate(locale, 'admin.providerSettings')}
        title={translate(locale, 'admin.providers')}
        description={translate(locale, 'admin.providerSettingsHelp')}
      />
      {message ? (
        <p className="admin-alert" role="status">
          {message}
        </p>
      ) : null}
      {providers === undefined ? (
        <Card>
          <CardContent className="admin-state">{translate(locale, 'admin.loading')}</CardContent>
        </Card>
      ) : (
        <div className="admin-provider-grid">
          {providers.map((provider) => (
            <Card key={provider.provider}>
              <CardHeader>
                <div className="admin-page-heading admin-page-heading--compact">
                  <div>
                    <CardTitle>{provider.provider}</CardTitle>
                    <CardDescription>{provider.displayName}</CardDescription>
                  </div>
                  <AdminStatusBadge tone={provider.configured ? 'success' : 'danger'}>
                    {provider.configured
                      ? translate(locale, 'admin.configured', {
                          environment: provider.environment,
                        })
                      : translate(locale, 'admin.notConfigured')}
                  </AdminStatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <form
                  className="admin-form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(provider);
                  }}
                >
                  <label className="admin-checkbox">
                    <Checkbox
                      aria-label={translate(locale, 'admin.enableForNewTransactions')}
                      checked={provider.enabled}
                      disabled={!provider.configured || saving !== null}
                      onCheckedChange={(checked) =>
                        change(provider.provider, { enabled: checked === true })
                      }
                    />
                    {translate(locale, 'admin.enableForNewTransactions')}
                  </label>
                  <label>
                    {translate(locale, 'admin.displayName')}
                    <Input
                      maxLength={120}
                      required
                      value={provider.displayName}
                      onChange={(event) =>
                        change(provider.provider, { displayName: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    {translate(locale, 'admin.displayOrder')}
                    <Input
                      min={0}
                      type="number"
                      value={provider.displayOrder}
                      onChange={(event) =>
                        change(provider.provider, { displayOrder: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    {translate(locale, 'admin.paymentSessionExpiry')}
                    <Input
                      max={60}
                      min={1}
                      type="number"
                      value={provider.checkoutExpiryMinutes}
                      onChange={(event) =>
                        change(provider.provider, {
                          checkoutExpiryMinutes: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    {translate(locale, 'admin.maintenanceMessage')}
                    <Textarea
                      maxLength={500}
                      value={provider.maintenanceMessage}
                      onChange={(event) =>
                        change(provider.provider, { maintenanceMessage: event.target.value })
                      }
                    />
                  </label>
                  <Button disabled={saving !== null} type="submit">
                    {saving === provider.provider
                      ? translate(locale, 'admin.saving')
                      : translate(locale, 'admin.saveConfiguration')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
