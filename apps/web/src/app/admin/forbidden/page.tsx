import { cookies } from 'next/headers';

import { resolveLocale, translate } from '../../../lib/i18n/messages';

export default async function Forbidden() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <main className="login-page">
      <section className="login-card">
        <h1>{translate(locale, 'admin.forbiddenHeading')}</h1>
        <p>{translate(locale, 'admin.forbiddenHelp')}</p>
      </section>
    </main>
  );
}
