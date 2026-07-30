import { cookies } from 'next/headers';

import { resolveLocale, translate } from '../../lib/i18n/messages';

export default async function Loading() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <div className="admin-page">
      <p aria-live="polite">{translate(locale, 'admin.loading')}</p>
    </div>
  );
}
