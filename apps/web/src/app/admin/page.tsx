import Link from 'next/link';
import { cookies } from 'next/headers';

import { resolveLocale, translate, type MessageKey } from '../../lib/i18n/messages';
import { OperationalReportDashboard } from '../../components/operational-report-dashboard';
import { RoomOperationsBoard } from '../../components/room-operations-board';

const setup = [
  ['admin.property', '/admin/property'],
  ['admin.priceTiers', '/admin/price-tiers'],
  ['admin.roomTypes', '/admin/room-types'],
  ['admin.amenities', '/admin/amenities'],
  ['admin.rooms', '/admin/rooms'],
  ['admin.maintenance', '/admin/maintenance'],
  ['admin.ratePlans', '/admin/rate-plans'],
  ['admin.coupons', '/admin/coupons'],
] as const satisfies readonly (readonly [MessageKey, string])[];
export default async function AdminPage() {
  const locale = resolveLocale((await cookies()).get('room_locale')?.value);
  return (
    <section className="admin-page">
      <h1>{translate(locale, 'admin.dashboardHeading')}</h1>
      <p>{translate(locale, 'admin.dashboardHelp')}</p>
      <OperationalReportDashboard />
      <RoomOperationsBoard />
      <ul className="setup-list">
        {setup.map(([label, href]) => (
          <li key={href}>
            <Link href={href}>
              {translate(locale, label)}
              <span>{translate(locale, 'admin.setup')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
