import { cookies } from 'next/headers';

import { resolveLocale, translate } from '../../../../../lib/i18n/messages';
import { AdminPageHeader } from '../../../../../components/admin/admin-ui';

export default async function Room({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <section className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'room.detailHeading', { id })}
        description={translate(locale, 'room.detailHelp')}
      />
    </section>
  );
}
