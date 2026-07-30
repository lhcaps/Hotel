'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GuestAccessOtpRequestResponse, GuestAccessOtpVerifyResponse } from '@room/contracts';

import { BookingDetailPanel } from '../../../components/booking-detail-panel';
import { OtpRequestPanel } from '../../../components/otp-request-panel';
import { OtpVerifyPanel } from '../../../components/otp-verify-panel';
import { useLocale } from '../../../components/locale-provider';
import { translate } from '../../../lib/i18n/messages';

type ManageState =
  | { readonly kind: 'requesting-otp' }
  | {
      readonly kind: 'verifying-otp';
      readonly bookingCode: string;
      readonly email: string;
      readonly challengeRef: string;
    }
  | {
      readonly kind: 'authenticated';
      readonly bookingCode: string;
      readonly email: string;
    };

export default function BookingManagePage() {
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<ManageState>({ kind: 'requesting-otp' });

  function handleOtpRequested(
    response: GuestAccessOtpRequestResponse,
    submitted: { readonly bookingCode: string; readonly email: string },
  ) {
    setState({
      kind: 'verifying-otp',
      bookingCode: submitted.bookingCode,
      email: submitted.email,
      challengeRef: response.challengeRef,
    });
  }

  function handleVerified(response: GuestAccessOtpVerifyResponse) {
    setState((current) => {
      if (current.kind !== 'verifying-otp') return current;
      // Replace the OTP entry route with the persistent booking-code route so
      // refresh and direct URL reuse rely only on the HttpOnly session cookie.
      // The destination never contains the OTP code, email, challengeRef, or
      // any other secret.
      router.replace(`/booking/manage/${response.bookingCode}`);
      return {
        kind: 'authenticated',
        bookingCode: response.bookingCode,
        email: current.email,
      };
    });
  }

  function resetToRequest() {
    setState({ kind: 'requesting-otp' });
  }

  return (
    <main className="guest-access-page" id="main-content">
      <div className="guest-access-page__inner">
        <header className="guest-access-page__heading">
          <p>{translate(locale, 'guest.manageEyebrow')}</p>
          <h1>{translate(locale, 'guest.manageHeading')}</h1>
          <p>{translate(locale, 'guest.manageHelp')}</p>
        </header>

        {state.kind === 'requesting-otp' ? (
          <OtpRequestPanel onOtpRequested={handleOtpRequested} />
        ) : null}

        {state.kind === 'verifying-otp' ? (
          <OtpVerifyPanel challengeRef={state.challengeRef} onVerified={handleVerified} />
        ) : null}

        {state.kind === 'authenticated' ? (
          <BookingDetailPanel
            bookingCode={state.bookingCode}
            email={state.email}
            onLogout={resetToRequest}
          />
        ) : null}
      </div>
    </main>
  );
}
