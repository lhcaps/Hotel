import { cookies } from 'next/headers';

import { RoomOperationsBoard } from '../../../../components/room-operations-board';
import { AdminPageHeader } from '../../../../components/admin/admin-ui';
import { resolveLocale, translate } from '../../../../lib/i18n/messages';

export default async function RoomOperationsPage() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <div className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.roomOperations')}
        description={translate(locale, 'admin.roomOperationsHelp')}
      />
      <RoomOperationsBoard />
    </div>
  );
}
