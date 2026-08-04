export const CLIENT_ROOM_IMPORT_VERSION = 'peace-home-23-rooms-v2';

export const CLIENT_ROOM_MANIFEST = Object.freeze({
  property: {
    defaultCode: 'PEACE_HOME',
    defaultName: 'Peace Home Homestay',
    timezone: 'Asia/Ho_Chi_Minh',
  },
  tiers: [
    {
      code: 'STANDARD',
      name: 'Standard',
      sortOrder: 1,
      maxAdults: 2,
      maxChildren: 1,
      maxOccupancy: 3,
    },
    { code: 'DELUXE', name: 'Deluxe', sortOrder: 2, maxAdults: 2, maxChildren: 2, maxOccupancy: 4 },
    {
      code: 'SIGNATURE',
      name: 'Signature',
      sortOrder: 3,
      maxAdults: 4,
      maxChildren: 2,
      maxOccupancy: 5,
    },
  ],
  rooms: [
    { name: 'Wabi', tierCode: 'SIGNATURE', physicalRoomCode: '94BDT-WabiG01' },
    { name: 'Wabi', tierCode: 'SIGNATURE', physicalRoomCode: '94BDT-Wabi101' },
    { name: 'Wabi', tierCode: 'SIGNATURE', physicalRoomCode: '94BDT-Wabi201' },
    { name: 'Wabi', tierCode: 'SIGNATURE', physicalRoomCode: '94BDT-Wabi301' },
    { name: 'Haven', tierCode: 'SIGNATURE', physicalRoomCode: '94BDT-HavenG03' },
    { name: 'Sabi', tierCode: 'DELUXE', physicalRoomCode: '94BDT-SabiG02' },
    { name: 'Sabi', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Sabi102' },
    { name: 'Sabi', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Sabi202' },
    { name: 'Sabi', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Sabi302' },
    { name: 'Sunset', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Sunset103' },
    { name: 'Sunset', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Sunset203' },
    { name: 'Sunset', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Sunset303' },
    { name: 'Yuki', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Yuki104' },
    { name: 'Yuki', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Yuki204' },
    { name: 'Yuki', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Yuki304' },
    { name: 'Sudal', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Sudal205' },
    { name: 'Sudal', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Sudal305' },
    { name: 'Nami', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Nami206' },
    { name: 'Nami', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Nami306' },
    { name: 'Phù Vân', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Phù Vân 207' },
    { name: 'Phù Vân', tierCode: 'DELUXE', physicalRoomCode: '94BDT-Phù vân 307' },
    { name: 'Rose', tierCode: 'STANDARD', physicalRoomCode: '94BDT-Rose208' },
    { name: 'Rose', tierCode: 'STANDARD', physicalRoomCode: '94BDT-Rose308' },
  ],
  ratePlans: [
    {
      code: 'LUNCH_COMBO',
      name: 'Trưa 11:00–14:00',
      includedDurationMinutes: 180,
      priority: 80,
      minCheckInMinuteInclusive: 660,
      maxCheckInMinuteExclusive: 900,
      minDurationMinutesInclusive: 180,
      maxDurationMinutesInclusive: 240,
      amounts: [359_000, 419_000, 489_000],
    },
    {
      code: 'THREE_HOUR_COMBO',
      name: 'Gói 3 giờ',
      includedDurationMinutes: 180,
      priority: 60,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 180,
      maxDurationMinutesInclusive: 240,
      amounts: [299_000, 349_000, 399_000],
    },
    {
      code: 'FIVE_HOUR_COMBO',
      name: 'Gói 5 giờ',
      includedDurationMinutes: 300,
      priority: 70,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 255,
      maxDurationMinutesInclusive: 960,
      amounts: [399_000, 469_000, 549_000],
    },
    {
      code: 'NIGHT_COMBO',
      name: 'Đêm 21:00–09:00 / 22:00–10:00',
      includedDurationMinutes: 720,
      priority: 90,
      minCheckInMinuteInclusive: 1260,
      maxCheckInMinuteExclusive: 1380,
      minDurationMinutesInclusive: 720,
      maxDurationMinutesInclusive: 960,
      amounts: [499_000, 589_000, 689_000],
    },
    {
      code: 'DAY_COMBO',
      name: 'Ngày 11:00–09:00 hôm sau',
      includedDurationMinutes: 1320,
      priority: 100,
      minCheckInMinuteInclusive: 660,
      maxCheckInMinuteExclusive: 900,
      minDurationMinutesInclusive: 1320,
      maxDurationMinutesInclusive: 1320,
      amounts: [749_000, 879_000, 1_029_000],
    },
    {
      code: 'EXTRA_HOUR',
      name: 'Thêm giờ',
      includedDurationMinutes: 60,
      priority: 10,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: null,
      maxDurationMinutesInclusive: null,
      amounts: [80_000, 95_000, 110_000],
    },
  ],
});

export function validateClientRoomManifest(): void {
  const names = CLIENT_ROOM_MANIFEST.rooms.map((room) => room.name);
  const physicalCodes = CLIENT_ROOM_MANIFEST.rooms.map((room) => room.physicalRoomCode);
  if (physicalCodes.length !== 23 || new Set(physicalCodes).size !== 23) {
    throw new Error('Client room manifest must contain exactly 23 unique physical room codes');
  }
  if (new Set(names).size !== 9) {
    throw new Error('Client room manifest must contain exactly nine room concepts');
  }
  const tierCodes = new Set(CLIENT_ROOM_MANIFEST.tiers.map((tier) => tier.code));
  if (CLIENT_ROOM_MANIFEST.rooms.some((room) => !tierCodes.has(room.tierCode))) {
    throw new Error('Client room manifest references an unknown tier');
  }
  for (const plan of CLIENT_ROOM_MANIFEST.ratePlans) {
    if (
      plan.amounts.length !== CLIENT_ROOM_MANIFEST.tiers.length ||
      plan.amounts.some((amount) => amount <= 0)
    ) {
      throw new Error(`Client price manifest is invalid for ${plan.code}`);
    }
  }
}
