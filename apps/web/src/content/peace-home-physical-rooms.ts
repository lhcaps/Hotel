import type {
  PublicRoomCatalogResponse,
  PublicRoomType,
} from '@room/contracts/public-room-catalog';

export type PeaceHomeTierCode = 'STANDARD' | 'DELUXE' | 'SIGNATURE';

export interface PeaceHomePhysicalRoom {
  readonly slug: string;
  readonly name: string;
  readonly tierCode: PeaceHomeTierCode;
  readonly startingFromVnd: number;
  readonly gallery: readonly [string, ...string[]];
}

// Names, tier membership, capacity/rate authority and order are derived from
// CLIENT_ROOM_MANIFEST. The image paths below are local WebP derivatives of
// individually selected originals from the client's Drive `Final` folder.
const gallery = (room: string, indexes: readonly [number, ...number[]]) =>
  indexes.map(
    (index) => `/images/peace-home/${room}/${room}-${index.toString().padStart(3, '0')}-hero.webp`,
  ) as [string, ...string[]];

export const peaceHomePhysicalRooms: readonly PeaceHomePhysicalRoom[] = [
  {
    slug: 'rose',
    name: 'Rose',
    tierCode: 'STANDARD',
    startingFromVnd: 299_000,
    gallery: gallery('rose', [66, 7, 14, 22, 44, 0]),
  },
  {
    slug: 'nami',
    name: 'Nami',
    tierCode: 'DELUXE',
    startingFromVnd: 349_000,
    gallery: gallery('nami', [30, 25, 35, 20, 46, 15]),
  },
  {
    slug: 'phu-van',
    name: 'Phù Vân',
    tierCode: 'DELUXE',
    startingFromVnd: 349_000,
    gallery: gallery('phu-van', [62, 20, 27, 34, 41, 48, 6]),
  },
  {
    slug: 'sunset',
    name: 'Sunset',
    tierCode: 'DELUXE',
    startingFromVnd: 349_000,
    gallery: gallery('sunset', [20, 0, 13, 27, 33, 40, 54]),
  },
  {
    slug: 'yuki',
    name: 'Yuki',
    tierCode: 'DELUXE',
    startingFromVnd: 349_000,
    gallery: gallery('yuki', [57, 25, 38, 44, 50, 12, 0]),
  },
  {
    slug: 'sabi',
    name: 'Sabi',
    tierCode: 'DELUXE',
    startingFromVnd: 349_000,
    gallery: gallery('sabi', [41, 23, 35, 0, 11, 17]),
  },
  {
    slug: 'sudal',
    name: 'Sudal',
    tierCode: 'DELUXE',
    startingFromVnd: 349_000,
    gallery: gallery('sudal', [28, 0, 5, 17, 40, 52]),
  },
  {
    slug: 'wabi',
    name: 'Wabi',
    tierCode: 'SIGNATURE',
    startingFromVnd: 399_000,
    gallery: gallery('wabi', [124, 110, 27, 55, 68, 96, 0]),
  },
  {
    slug: 'haven',
    name: 'Haven',
    tierCode: 'SIGNATURE',
    startingFromVnd: 399_000,
    gallery: gallery('haven', [49, 43, 32, 38, 16, 21, 5]),
  },
];

export interface PresentedPhysicalRoom extends PeaceHomePhysicalRoom {
  readonly roomType: PublicRoomType;
}

export function roomStartingPrice(room: PresentedPhysicalRoom): number | null {
  return room.roomType.startingFromVnd ?? room.startingFromVnd;
}

export interface PresentedTierSummary {
  readonly code: PeaceHomeTierCode;
  readonly name: string;
  readonly rooms: readonly PresentedPhysicalRoom[];
  readonly representative: PresentedPhysicalRoom;
}

export function presentTierSummaries(
  catalog: PublicRoomCatalogResponse,
): readonly PresentedTierSummary[] {
  const groups = new Map<PeaceHomeTierCode, PresentedPhysicalRoom[]>();
  for (const room of presentPhysicalRooms(catalog)) {
    const group = groups.get(room.tierCode) ?? [];
    group.push(room);
    groups.set(room.tierCode, group);
  }
  return (['STANDARD', 'DELUXE', 'SIGNATURE'] as const).flatMap((code) => {
    const rooms = groups.get(code) ?? [];
    const representative = rooms[0];
    if (representative === undefined) return [];
    return [
      {
        code,
        name: representative.roomType.priceTier?.name ?? code,
        rooms,
        representative,
      },
    ];
  });
}

export function presentPhysicalRooms(
  catalog: PublicRoomCatalogResponse,
): readonly PresentedPhysicalRoom[] {
  return peaceHomePhysicalRooms.flatMap((room) => {
    const roomType = catalog.items.find(
      (item) => item.name.trim().toLocaleUpperCase('en-US') === room.name.toUpperCase(),
    );
    return roomType === undefined ? [] : [{ ...room, roomType }];
  });
}

export function findPresentedPhysicalRoom(
  catalog: PublicRoomCatalogResponse,
  slugOrRoomTypeId: string,
): PresentedPhysicalRoom | undefined {
  return presentPhysicalRooms(catalog).find(
    (room) => room.slug === slugOrRoomTypeId || room.roomType.id === slugOrRoomTypeId,
  );
}

export const peaceHomeCommonImages = gallery('common', [27, 18, 36, 46, 64, 73, 83, 9]);
