import { cookies } from 'next/headers';

import { resolveLocale, translate } from '../../../../../lib/i18n/messages';

export default async function Room({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <section className="admin-page">
      <h1>{translate(locale, 'room.detailHeading', { id })}</h1>
      <p>{translate(locale, 'room.detailHelp')}</p>
    </section>
  );
}
