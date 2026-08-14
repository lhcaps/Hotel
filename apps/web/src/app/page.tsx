import type { PublicRoomCatalogResponse } from '@room/contracts/public-room-catalog';

import { PublicLanding } from '../components/public-landing';
import { loadPublicRoomCatalog } from '../lib/public-room-catalog';
import { loadPublicContact } from '../lib/public-contact';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{ __catalog?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const catalog = await loadPublicRoomCatalog();
  const params = await searchParams;
  const defaultPropertyCode = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_CODE ?? '';
  const contact = defaultPropertyCode === '' ? null : await loadPublicContact(defaultPropertyCode);

  // Test helper: ?__catalog=error and ?__catalog=empty simulate catalog
  // failure states. These are strictly disabled outside NODE_ENV=test so an
  // ordinary user can never trigger them in production or development.
  let effectiveCatalog: PublicRoomCatalogResponse | null = catalog;
  if (process.env.NODE_ENV === 'test') {
    if (params.__catalog === 'error') {
      effectiveCatalog = null;
    } else if (params.__catalog === 'empty') {
      effectiveCatalog = { items: [] };
    }
  }

  return <PublicLanding catalog={effectiveCatalog} contact={contact ?? null} />;
}
