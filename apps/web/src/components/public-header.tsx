'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MenuIcon } from 'lucide-react';

import { type Locale, translate } from '../lib/i18n/messages';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { LocaleSwitch } from './locale-switch';

type CustomerState = 'unknown' | 'anonymous' | 'customer';

export function PublicHeader({
  locale,
  children,
}: Readonly<{ locale: Locale; children?: React.ReactNode }>) {
  const router = useRouter();
  const [customerState, setCustomerState] = useState<CustomerState>('unknown');
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBase === undefined) {
      setCustomerState('anonymous');
      return undefined;
    }
    void fetch(`${new URL(apiBase).origin}/api/v1/customer/profile/session`, {
      credentials: 'include',
    })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => undefined);
        const authenticated =
          response.ok &&
          typeof body === 'object' &&
          body !== null &&
          'authenticated' in body &&
          body.authenticated === true;
        if (!cancelled) setCustomerState(authenticated ? 'customer' : 'anonymous');
      })
      .catch(() => !cancelled && setCustomerState('anonymous'));
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (apiBase !== undefined)
        await fetch(`${new URL(apiBase).origin}/api/auth/sign-out`, {
          method: 'POST',
          credentials: 'include',
        });
      setCustomerState('anonymous');
      router.refresh();
    } finally {
      setLogoutPending(false);
    }
  }

  const bookingLabel = translate(
    locale,
    customerState === 'customer' ? 'public.newBooking' : 'public.booking',
  );
  const accountLink = customerState === 'customer' ? '/account/bookings' : '/booking/manage';
  const accountLabel = translate(
    locale,
    customerState === 'customer' ? 'public.myBookings' : 'public.guestAccess',
  );
  const navLinks = (
    <>
      <Link href="/#booking">{bookingLabel}</Link>
      <Link href="/rooms">{translate(locale, 'public.roomsPricing')}</Link>
      <Link href="/#offers">{translate(locale, 'public.offers')}</Link>
      <Link href="/#about">{translate(locale, 'public.about')}</Link>
      <Link href="/#contact">{translate(locale, 'public.contact')}</Link>
      <Link href={accountLink}>{accountLabel}</Link>
    </>
  );

  return (
    <>
      <header className="public-header">
        <div className="public-header__inner">
          <Link className="public-header__brand" href="/">
            {translate(locale, 'public.brand')}
          </Link>
          <nav
            aria-label={translate(locale, 'public.navigation')}
            className="public-header__nav"
            id="public-navigation"
          >
            {navLinks}
          </nav>
          <div className="public-header__actions">
            <div className="public-header__locale">
              <LocaleSwitch locale={locale} />
            </div>
            {customerState === 'customer' ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={translate(locale, 'public.accountMenu')}
                      className="public-header__account-trigger"
                      size="icon"
                      variant="ghost"
                    />
                  }
                >
                  <Avatar>
                    <AvatarFallback>RM</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href="/account/profile" />}>
                      {translate(locale, 'account.profile')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/account/bookings" />}>
                      {translate(locale, 'public.myBookings')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/account/settings" />}>
                      {translate(locale, 'account.settings')}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={logoutPending}
                    onClick={() => void logout()}
                    variant="destructive"
                  >
                    {translate(locale, 'public.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link className="public-header__login" href="/login">
                {translate(locale, 'public.login')}
              </Link>
            )}
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    aria-label={translate(locale, 'public.menu')}
                    className="public-header__menu-toggle"
                    size="icon"
                    variant="ghost"
                  />
                }
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>{translate(locale, 'public.navigation')}</SheetTitle>
                </SheetHeader>
                <nav
                  aria-label={translate(locale, 'public.navigation')}
                  className="public-header__sheet-nav"
                >
                  {navLinks}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
