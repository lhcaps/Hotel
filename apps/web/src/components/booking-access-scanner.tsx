'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { adminApi } from '../lib/admin-api';
import { translate } from '../lib/i18n/messages';
import { useLocale } from './locale-provider';
import { AdminPageHeader } from './admin/admin-ui';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

type ScanResult = { readonly bookingCode: string; readonly action: 'check-in' | 'check-out' };

export function BookingAccessScanner() {
  const locale = useLocale();
  const [value, setValue] = useState('');
  const [result, setResult] = useState<ScanResult>();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stopCamera = useRef<(() => void) | undefined>(undefined);

  useEffect(() => () => stopCamera.current?.(), []);

  async function startCamera() {
    if (cameraPending || video.current === null) return;
    setCameraPending(true);
    setCameraError(false);
    stopCamera.current?.();
    try {
      const onValue = (next: string) => {
        setValue(next);
        stopCamera.current?.();
      };
      const detector = (
        window as unknown as {
          BarcodeDetector?: new (options: { formats: readonly string[] }) => {
            detect(source: ImageBitmapSource): Promise<readonly { readonly rawValue?: string }[]>;
          };
        }
      ).BarcodeDetector;
      if (detector !== undefined) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        video.current.srcObject = stream;
        await video.current.play();
        const scanner = new detector({ formats: ['qr_code'] });
        let active = true;
        const scan = async (): Promise<void> => {
          if (!active || video.current === null) return;
          const [code] = await scanner.detect(video.current as unknown as ImageBitmapSource);
          if (code?.rawValue !== undefined && code.rawValue !== '') {
            onValue(code.rawValue);
            return;
          }
          window.setTimeout(() => void scan(), 250);
        };
        stopCamera.current = () => {
          active = false;
          stream.getTracks().forEach((track) => track.stop());
        };
        void scan();
      } else {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const scanner = new BrowserQRCodeReader();
        const controls = await scanner.decodeFromVideoDevice(undefined, video.current, (result) => {
          if (result !== undefined) onValue(result.getText());
        });
        stopCamera.current = () => controls.stop();
      }
    } catch {
      setCameraError(true);
    } finally {
      setCameraPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || value.trim() === '') return;
    setPending(true);
    setError(false);
    setResult(undefined);
    try {
      const next = await adminApi.scanBookingAccessPass(value.trim());
      setResult({ bookingCode: next.bookingCode, action: next.action });
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-page" aria-labelledby="booking-access-scanner-heading">
      <AdminPageHeader
        title={translate(locale, 'admin.scanner')}
        description={translate(locale, 'admin.scannerHelp')}
      />
      <form className="admin-card" onSubmit={(event) => void submit(event)}>
        <label htmlFor="booking-access-pass">{translate(locale, 'admin.scannerValue')}</label>
        <Textarea
          id="booking-access-pass"
          onChange={(event) => setValue(event.target.value)}
          required
          rows={4}
          value={value}
        />
        <Button disabled={pending} type="submit">
          {translate(locale, 'admin.verifyPass')}
        </Button>
      </form>
      <section className="admin-card" aria-labelledby="booking-access-camera-heading">
        <h2 id="booking-access-camera-heading">{translate(locale, 'admin.scannerCamera')}</h2>
        <video className="max-w-full" muted playsInline ref={video} />
        <Button disabled={cameraPending} onClick={() => void startCamera()} type="button">
          {translate(locale, 'admin.startCamera')}
        </Button>
        {cameraError ? <p role="alert">{translate(locale, 'admin.cameraError')}</p> : null}
      </section>
      {error ? <p role="alert">{translate(locale, 'admin.scannerError')}</p> : null}
      {result === undefined ? null : (
        <section aria-live="polite" className="admin-card">
          <h2>
            {translate(
              locale,
              result.action === 'check-in' ? 'admin.readyCheckIn' : 'admin.readyCheckOut',
            )}
          </h2>
          <p>{result.bookingCode}</p>
          <Link className="primary-button" href={`/admin/bookings/${result.bookingCode}`}>
            {translate(locale, 'admin.openBooking')}
          </Link>
        </section>
      )}
    </section>
  );
}
