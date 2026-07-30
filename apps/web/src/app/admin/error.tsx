'use client';
import { useLocale } from '../../components/locale-provider';
import { translate } from '../../lib/i18n/messages';
export default function Error({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const locale = useLocale();
  return (
    <div className="admin-page">
      <h1>{translate(locale, 'admin.loadErrorHeading')}</h1>
      <p>{translate(locale, 'admin.loadErrorHelp')}</p>
      <button onClick={reset}>{translate(locale, 'admin.retry')}</button>
    </div>
  );
}
