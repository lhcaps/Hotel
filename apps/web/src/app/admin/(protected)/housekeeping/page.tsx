import { cookies } from 'next/headers';

import { HousekeepingWorkboard } from '../../../../components/housekeeping-workboard';
import { AdminPageHeader } from '../../../../components/admin/admin-ui';
import { resolveLocale, translate } from '../../../../lib/i18n/messages';

export default async function HousekeepingPage() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <div className="admin-page">
      <AdminPageHeader
        title={translate(locale, 'admin.housekeepingWorkboard')}
        description={translate(locale, 'admin.housekeepingWorkboardHelp')}
      />
      <HousekeepingWorkboard />
    </div>
  );
}
