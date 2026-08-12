const DAY_MS = 24 * 60 * 60_000;

export function futureLunchInterval(now = new Date(), offsetDays) {
  const days = offsetDays ?? 2 + Math.floor(Math.random() * 28);
  const target = new Date(now.getTime() + days * DAY_MS);
  const checkIn = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 4, 0, 0, 0),
  );
  return {
    checkIn: checkIn.toISOString(),
    checkOut: new Date(checkIn.getTime() + 3 * 60 * 60_000).toISOString(),
    mode: 'hourly',
    adults: 2,
    children: 0,
  };
}

export function selectAvailableRoomType(items) {
  if (!Array.isArray(items)) return undefined;
  return items.find(
    (item) =>
      typeof item?.roomTypeId === 'string' &&
      item.roomTypeId.length > 0 &&
      Number.isInteger(item.availableRoomCount) &&
      item.availableRoomCount > 0 &&
      item.offer?.amountVnd > 0,
  )?.roomTypeId;
}
