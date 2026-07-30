import {
  publicRoomCatalogResponseSchema,
  type PublicRoomCatalogResponse,
  type PublicRoomType,
} from '@room/contracts/public-room-catalog';

export async function loadPublicRoomCatalog(): Promise<PublicRoomCatalogResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
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
  '/images/hospitality/hero-suite.png',
  '/images/hospitality/family-suite.png',
  '/images/hospitality/executive-suite.png',
] as const;

export function publicRoomImage(roomTypeId: string): string {
  const index = [...roomTypeId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return roomImages[index % roomImages.length] ?? roomImages[0];
}
