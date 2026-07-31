'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Field, FieldGroup, FieldLabel } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Spinner } from '../../../components/ui/spinner';
import { LocaleSwitch } from '../../../components/locale-switch';
import { useLocale } from '../../../components/locale-provider';
import { translate } from '../../../lib/i18n/messages';

export default function AdminLoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCustomerSession = searchParams?.get('customer') === '1';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [customerLogoutPending, setCustomerLogoutPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (searchParams?.get('customer') !== '1') return;
    // Stash the URL flag in the page so the notice renders on first paint.
  }, [searchParams]);

  async function login(form: FormData) {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      if (!response.ok) {
        setError(translate(locale, 'admin.loginError'));
        return;
      }
      const meResponse = await fetch('/api/admin/me', {
        credentials: 'same-origin',
      });
      if (!meResponse.ok) {
        setError(translate(locale, 'admin.loginError'));
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError(translate(locale, 'admin.loginError'));
    } finally {
      setPending(false);
    }
  }

  async function signOutCustomer() {
    if (customerLogoutPending) return;
    setCustomerLogoutPending(true);
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'same-origin',
      });
      // Remove the URL flag so the notice disappears once the customer
      // session is gone.
      router.replace('/admin/login');
      router.refresh();
    } finally {
      setCustomerLogoutPending(false);
    }
  }

  return (
    <main aria-label={translate(locale, 'admin.loginAreaLabel')} className="admin-login-page">
      <div className="admin-login-locale">
        <LocaleSwitch locale={locale} />
      </div>
      <Card className="admin-login-card" size="sm">
        <CardHeader>
          <CardTitle>{translate(locale, 'admin.loginHeading')}</CardTitle>
          <CardDescription>{translate(locale, 'admin.loginAdminOnly')}</CardDescription>
        </CardHeader>
        {isCustomerSession ? (
          <Alert className="admin-login-customer-notice" variant="destructive">
            <AlertTitle>{translate(locale, 'admin.customerSessionTitle')}</AlertTitle>
            <AlertDescription>{translate(locale, 'admin.customerSessionHelp')}</AlertDescription>
            <Button
              className="admin-login-customer-logout"
              disabled={customerLogoutPending}
              onClick={() => void signOutCustomer()}
              size="sm"
              type="button"
              variant="outline"
            >
              {customerLogoutPending
                ? translate(locale, 'admin.customerSessionLogoutPending')
                : translate(locale, 'admin.customerSessionLogout')}
            </Button>
          </Alert>
        ) : null}
        <form action={login} ref={formRef}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-login-email">Email</FieldLabel>
                <Input
                  autoComplete="email"
                  id="admin-login-email"
                  name="email"
                  required
                  type="email"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-login-password">
                  {translate(locale, 'admin.password')}
                </FieldLabel>
                <Input
                  autoComplete="current-password"
                  id="admin-login-password"
                  name="password"
                  required
                  type="password"
                />
              </Field>
              {error === undefined ? null : (
                <Alert className="admin-login-error" variant="destructive">
                  <AlertTitle>{translate(locale, 'admin.loginErrorTitle')}</AlertTitle>
                  <AlertDescription>{translate(locale, 'admin.loginError')}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="admin-login-card-footer">
            <Button className="admin-login-submit" disabled={pending} type="submit">
              {pending ? (
                <>
                  <Spinner aria-hidden="true" />
                  {translate(locale, 'admin.signingIn')}
                </>
              ) : (
                translate(locale, 'admin.signIn')
              )}
            </Button>
            <Link className="admin-login-back" href="/">
              {translate(locale, 'admin.loginBackToBooking')}
            </Link>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
