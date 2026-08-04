import { cookies } from 'next/headers';

import { RoomOperationsBoard } from '../../../../components/room-operations-board';
import { resolveLocale, translate } from '../../../../lib/i18n/messages';

export default async function RoomOperationsPage() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <main className="admin-page">
      <h1>{translate(locale, 'admin.roomOperations')}</h1>
      <p>{translate(locale, 'admin.roomOperationsHelp')}</p>
      <RoomOperationsBoard viewerMode />
    </main>
  );
}
