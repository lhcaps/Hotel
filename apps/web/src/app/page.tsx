import { PublicLanding } from '../components/public-landing';
import { loadPublicRoomCatalog } from '../lib/public-room-catalog';

export default async function HomePage() {
  const catalog = await loadPublicRoomCatalog();
  return <PublicLanding catalog={catalog} />;
}
