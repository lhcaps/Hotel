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
import { resolvePublicApiOrigin } from '../lib/public-api-origin';

type AccountState = 'unknown' | 'anonymous' | 'customer' | 'admin';

export function PublicHeader({
  locale,
  children,
}: Readonly<{ locale: Locale; children?: React.ReactNode }>) {
  const router = useRouter();
  const [accountState, setAccountState] = useState<AccountState>('unknown');
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const origin = resolvePublicApiOrigin();
    if (origin === undefined) {
      setAccountState('anonymous');
      return undefined;
    }
    void fetch(`${origin}/api/auth/get-session`, { credentials: 'include' })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => undefined);
        const role =
          typeof body === 'object' && body !== null && 'user' in body
            ? (body as { user?: { role?: unknown } }).user?.role
            : undefined;
        if (!cancelled) {
          setAccountState(
            role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'ROOM_STATUS_VIEWER'
              ? 'admin'
              : role === 'CUSTOMER'
                ? 'customer'
                : 'anonymous',
          );
        }
      })
      .catch(() => !cancelled && setAccountState('anonymous'));
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      const origin = resolvePublicApiOrigin();
      if (origin !== undefined)
        await fetch(`${origin}/api/auth/sign-out`, {
          method: 'POST',
          credentials: 'include',
        });
      setAccountState('anonymous');
      router.refresh();
    } finally {
      setLogoutPending(false);
    }
  }

  const bookingLabel = translate(
    locale,
    accountState === 'customer' ? 'public.newBooking' : 'public.booking',
  );
  const accountLink = accountState === 'customer' ? '/account/bookings' : '/booking/manage';
  const accountLabel = translate(
    locale,
    accountState === 'customer' ? 'public.myBookings' : 'public.guestAccess',
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

  const authLinks =
    accountState === 'customer' ? (
      <>
        <Link href="/account/bookings">{translate(locale, 'public.myBookings')}</Link>
        <button disabled={logoutPending} onClick={() => void logout()} type="button">
          {translate(locale, 'public.logout')}
        </button>
      </>
    ) : accountState === 'admin' ? (
      <>
        <Link href="/admin">{translate(locale, 'public.adminDashboard')}</Link>
        <button disabled={logoutPending} onClick={() => void logout()} type="button">
          {translate(locale, 'public.logout')}
        </button>
      </>
    ) : (
      <>
        <Link href="/login">{translate(locale, 'public.customerLogin')}</Link>
        <Link href="/admin/login">{translate(locale, 'public.adminLogin')}</Link>
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
            {accountState === 'customer' ? (
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
                    <AvatarFallback>PN</AvatarFallback>
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
              <div className="public-header__auth-links">{authLinks}</div>
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
                  {authLinks}
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
