export const CLIENT_ROOM_IMPORT_VERSION = 'peace-home-9-rooms-v1';

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
    { name: 'Rose', tierCode: 'STANDARD' },
    { name: 'Nami', tierCode: 'DELUXE' },
    { name: 'Phù Vân', tierCode: 'DELUXE' },
    { name: 'Sunset', tierCode: 'DELUXE' },
    { name: 'Yuki', tierCode: 'DELUXE' },
    { name: 'Sabi', tierCode: 'DELUXE' },
    { name: 'Sudal', tierCode: 'DELUXE' },
    { name: 'Wabi', tierCode: 'SIGNATURE' },
    { name: 'Haven', tierCode: 'SIGNATURE' },
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
      maxDurationMinutesInclusive: 180,
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
      maxDurationMinutesInclusive: 180,
      amounts: [299_000, 349_000, 399_000],
    },
    {
      code: 'FIVE_HOUR_COMBO',
      name: 'Gói 5 giờ',
      includedDurationMinutes: 300,
      priority: 70,
      minCheckInMinuteInclusive: null,
      maxCheckInMinuteExclusive: null,
      minDurationMinutesInclusive: 300,
      maxDurationMinutesInclusive: 300,
      amounts: [399_000, 469_000, 549_000],
    },
    {
      code: 'NIGHT_COMBO',
      name: 'Đêm 21:00–09:00 / 22:00–10:00',
      includedDurationMinutes: 720,
      priority: 90,
      minCheckInMinuteInclusive: 1260,
      maxCheckInMinuteExclusive: 1440,
      minDurationMinutesInclusive: 720,
      maxDurationMinutesInclusive: 720,
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
  if (names.length !== 9 || new Set(names).size !== 9) {
    throw new Error('Client room manifest must contain exactly nine unique rooms');
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
