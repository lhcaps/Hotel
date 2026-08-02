import {
  publicRoomCatalogResponseSchema,
  type PublicRoomCatalogResponse,
  type PublicRoomType,
} from '@room/contracts/public-room-catalog';

export async function loadPublicRoomCatalog(): Promise<PublicRoomCatalogResponse | null> {
  // Catalog loaders run on the Next.js server. Prefer the private Compose
  // network so public-page rendering does not depend on resolving the public
  // hostname from inside an application container.
  const baseUrl = process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (baseUrl === undefined) return null;
  try {
    const response = await fetch(`${baseUrl}/public/room-types`, { cache: 'no-store' });
    if (!response.ok) return null;
    return publicRoomCatalogResponseSchema.parse(await response.json());
  } catch {
    return null;
  }
}

export async function loadPublicRoomType(roomTypeId: string): Promise<PublicRoomType | null> {
  const catalog = await loadPublicRoomCatalog();
  return catalog?.items.find((room) => room.id === roomTypeId) ?? null;
}

const roomImages = [
  '/images/peace-home/rose/rose-066-card.webp',
  '/images/peace-home/nami/nami-030-card.webp',
  '/images/peace-home/wabi/wabi-124-card.webp',
] as const;

export function publicRoomImage(roomTypeId: string): string {
  const index = [...roomTypeId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return roomImages[index % roomImages.length] ?? roomImages[0];
}
